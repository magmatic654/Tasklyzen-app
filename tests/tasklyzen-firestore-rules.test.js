/*
 * Contrato: reglas Firestore y whitelist cloud.
 * Entradas: firestore.rules y tasklyzen-config.js.
 * Salidas: evita que cliente y reglas acepten conjuntos distintos de campos.
 */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function loadConfig() {
    const context = { window: null };
    context.window = context;
    const source = fs.readFileSync(path.join(projectRoot, 'tasklyzen-config.js'), 'utf8');

    vm.runInNewContext(source, context, { filename: 'tasklyzen-config.js' });
    return context.TasklyzenConfig;
}

function getRuleSyncFields(rules) {
    const match = rules.match(/function allowedSyncFields\(\)\s*\{\s*return\s*\[([\s\S]*?)\];\s*\}/);

    assert.ok(match, 'firestore.rules debe declarar allowedSyncFields');
    return Array.from(match[1].matchAll(/'([^']+)'/g), value => value[1]);
}

test('las reglas de Firestore protegen por UID y siguen la whitelist cloud', () => {
    const rules = fs.readFileSync(path.join(projectRoot, 'firestore.rules'), 'utf8');
    const config = loadConfig();
    const allowedFields = getRuleSyncFields(rules);

    assert.deepStrictEqual(allowedFields.slice().sort(), Array.from(config.cloudStorageKeys).sort());
    config.localOnlyStorageKeys.forEach(key => {
        assert.strictEqual(allowedFields.includes(key), false, key + ' no puede viajar a Firestore');
    });
    assert.match(rules, /match \/users\/\{userId\}/);
    assert.match(rules, /request\.auth != null && request\.auth\.uid == userId/);
    assert.match(rules, /allow update: if ownsUser\(userId\)[\s\S]*affectedKeys\(\)\.hasOnly\(allowedSyncFields\(\)\)/);
    assert.match(rules, /allow delete: if ownsUser\(userId\);/);
});
