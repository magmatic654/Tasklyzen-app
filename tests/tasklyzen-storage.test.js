/*
 * Integracion: almacenamiento Local-First.
 * Entradas: modulos reales con localStorage, DOM y Firestore simulados.
 * Salidas: protege migracion, respaldo e interacciones local/nube.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createLocalStorage(initialValues) {
    const values = new Map(Object.entries(initialValues || {}));

    return {
        get length() {
            return values.size;
        },
        key(index) {
            return Array.from(values.keys())[index] || null;
        },
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

function loadModule(context, fileName) {
    const source = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');

    vm.runInNewContext(source, context, { filename: fileName });
}

function createStorageContext(options) {
    const config = options || {};
    const nodes = config.nodes || {};
    const localStorage = createLocalStorage(config.initialStorage);
    const context = {
        console: { error() {}, warn() {} },
        Date,
        JSON,
        Map,
        Object,
        Promise,
        Set,
        String,
        localStorage,
        document: {
            getElementById(id) {
                return nodes[id] || null;
            }
        },
        addEventListener() {},
        dispatchEvent() {},
        CustomEvent: class CustomEvent {
            constructor(type, options) {
                this.type = type;
                this.detail = options && options.detail;
            }
        },
        StorageEvent: class StorageEvent {
            constructor(type, options) {
                this.type = type;
                this.key = options && options.key;
                this.newValue = options && options.newValue;
            }
        },
        window: null
    };

    context.window = context;
    loadModule(context, 'tasklyzen-config.js');
    loadModule(context, 'tasklyzen-data-migration.js');
    loadModule(context, 'tasklyzen-storage.js');

    return { context, localStorage, storage: context.TasklyzenStorage };
}

function createConflictNodes() {
    const nodes = {};

    function createButton(id) {
        const listeners = {};

        return {
            cloneNode() {
                return createButton(id);
            },
            replaceWith(nextButton) {
                nodes[id] = nextButton;
            },
            addEventListener(type, listener) {
                listeners[type] = listener;
            },
            click() {
                if (listeners.click) listeners.click();
            }
        };
    }

    nodes['data-conflict-dialog'] = {
        open: false,
        showModal() {
            this.open = true;
        },
        close() {
            this.open = false;
        }
    };
    nodes['conflict-keep-cloud'] = createButton('conflict-keep-cloud');
    nodes['conflict-keep-local'] = createButton('conflict-keep-local');
    nodes['conflict-local-tasks'] = { textContent: '' };
    nodes['conflict-local-done'] = { textContent: '' };
    nodes['conflict-cloud-tasks'] = { textContent: '' };
    nodes['conflict-cloud-done'] = { textContent: '' };

    return nodes;
}

function createCloudDatabase(cloudData, writes) {
    const document = {
        get() {
            return Promise.resolve({
                exists: true,
                data() {
                    return cloudData;
                }
            });
        },
        set(data, options) {
            writes.push({ data, options });
            return Promise.resolve();
        },
        onSnapshot() {
            return () => {};
        }
    };

    return {
        collection() {
            return {
                doc() {
                    return document;
                }
            };
        }
    };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

test('la migracion de logros retirados es idempotente y conserva datos canonicos', () => {
    const { context, localStorage, storage } = createStorageContext();

    localStorage.setItem('todo-achievements', JSON.stringify({ legacy: true }));
    localStorage.setItem('todo-gamification', JSON.stringify({
        usedShields: 2,
        protectedDates: ['2026-07-03'],
        achievementStates: { legacy: true }
    }));
    localStorage.setItem('todos', JSON.stringify([{ id: 'task-1', text: 'Conservar' }]));

    assert.strictEqual(storage.migrateLegacyData(), true);
    assert.strictEqual(storage.migrateLegacyData(), false);
    assert.strictEqual(localStorage.getItem('todo-achievements'), null);
    assert.deepStrictEqual(JSON.parse(localStorage.getItem('todo-gamification')), {
        usedShields: 2,
        protectedDates: ['2026-07-03']
    });
    assert.strictEqual(
        localStorage.getItem(context.TasklyzenConfig.storageKeys.todos),
        JSON.stringify([{ id: 'task-1', text: 'Conservar' }])
    );
});

test('una restauracion reemplaza solo claves declaradas y conserva la estrategia local de acceso', () => {
    const importedTodos = JSON.stringify([{ id: 'from-backup', text: 'Restaurada' }]);
    const importedSettings = JSON.stringify({ theme: 'dark', progressMode: 'focus' });
    const { context, localStorage, storage } = createStorageContext({
        initialStorage: {
            todos: JSON.stringify([{ id: 'before-import', text: 'Anterior' }]),
            'todo-developer-snapshot': JSON.stringify({ active: true }),
            'tasklyzen-login-strategy': 'local'
        }
    });
    const toasts = [];
    let imported = 0;

    class FakeFileReader {
        constructor() {
            this.listeners = {};
            this.result = '';
        }

        addEventListener(type, listener) {
            this.listeners[type] = listener;
        }

        readAsText(file) {
            this.result = file.text;
            this.listeners.load();
        }
    }

    context.FileReader = FakeFileReader;
    loadModule(context, 'tasklyzen-settings.js');
    const controller = context.TasklyzenSettings.createSettingsController({
        storage,
        storageKey: context.TasklyzenConfig.storageKeys.settings,
        storageKeys: context.TasklyzenConfig.storageKeys,
        dom: { settingsImportFile: { value: 'backup.json' } },
        onAfterImport() {
            imported += 1;
        },
        showToast(message, type) {
            toasts.push({ message, type });
        }
    });

    controller.importData({
        text: JSON.stringify({
            app: 'Tasklyzen',
            version: 1,
            storage: {
                todos: importedTodos,
                'tasklyzen-settings': importedSettings
            }
        })
    });

    assert.strictEqual(localStorage.getItem(context.TasklyzenConfig.storageKeys.todos), importedTodos);
    assert.strictEqual(localStorage.getItem(context.TasklyzenConfig.storageKeys.settings), importedSettings);
    assert.strictEqual(localStorage.getItem(context.TasklyzenConfig.storageKeys.developerSnapshot), null);
    assert.strictEqual(localStorage.getItem('tasklyzen-login-strategy'), 'local');
    assert.strictEqual(imported, 1);
    assert.deepStrictEqual(toasts, [{ message: 'Respaldo restaurado correctamente.', type: 'success' }]);
});

test('el usuario puede conservar la copia cloud o local cuando hay conflicto de tareas', async () => {
    const todoKey = 'todos';
    const cloudTodos = JSON.stringify([{ id: 'cloud-task', text: 'Nube' }]);
    const localTodos = JSON.stringify([{ id: 'local-task', text: 'Local' }]);

    const cloudNodes = createConflictNodes();
    const cloudWrites = [];
    const cloudChoice = createStorageContext({
        nodes: cloudNodes,
        initialStorage: { [todoKey]: localTodos }
    });
    const cloudContext = cloudChoice.context;
    cloudContext.firebase = { firestore: { FieldValue: { delete: () => ({ delete: true }) } } };
    const cloudReady = cloudChoice.storage.onAuthChange(
        { uid: 'keep-cloud' },
        createCloudDatabase({ [todoKey]: cloudTodos }, cloudWrites)
    );

    await flushPromises();
    assert.strictEqual(cloudNodes['data-conflict-dialog'].open, true);
    cloudNodes['conflict-keep-cloud'].click();
    await cloudReady;
    assert.strictEqual(cloudChoice.localStorage.getItem(todoKey), cloudTodos);
    assert.strictEqual(cloudWrites.length, 0);

    const localNodes = createConflictNodes();
    const localWrites = [];
    const localChoice = createStorageContext({
        nodes: localNodes,
        initialStorage: { [todoKey]: localTodos }
    });
    localChoice.context.firebase = { firestore: { FieldValue: { delete: () => ({ delete: true }) } } };
    const localReady = localChoice.storage.onAuthChange(
        { uid: 'keep-local' },
        createCloudDatabase({ [todoKey]: cloudTodos }, localWrites)
    );

    await flushPromises();
    assert.strictEqual(localNodes['data-conflict-dialog'].open, true);
    localNodes['conflict-keep-local'].click();
    await localReady;
    assert.strictEqual(localChoice.localStorage.getItem(todoKey), localTodos);
    assert.strictEqual(localWrites.length, 1);
    assert.strictEqual(localWrites[0].data[todoKey], localTodos);
});
