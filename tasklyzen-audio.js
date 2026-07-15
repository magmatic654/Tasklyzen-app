/*
 * Propósito: sintetizar señales breves de Tasklyzen con Web Audio.
 * Entradas: ajustes actuales, tipo de señal y volumen.
 * Salidas: motivos de finalización y transiciones de Modo Carrera.
 */
(function initTasklyzenAudio(global) {
    'use strict';

    function noop() {}

    function createAudioController(options) {
        const config = options || {};
        const windowRef = config.windowRef || global;
        const getSettings = typeof config.getSettings === 'function'
            ? config.getSettings
            : () => ({ sound: false, soundVolume: 0.7 });
        const onError = typeof config.onError === 'function' ? config.onError : noop;
        let audioContext = null;

        function getVolume() {
            const settings = getSettings() || {};

            return settings.sound
                ? Math.min(Math.max(Number(settings.soundVolume) || 0, 0), 1)
                : 0;
        }

        function getAudioContext() {
            if (audioContext) {
                return audioContext;
            }

            const AudioContextConstructor = windowRef.AudioContext || windowRef.webkitAudioContext;

            if (!AudioContextConstructor) {
                return null;
            }

            audioContext = new AudioContextConstructor();
            return audioContext;
        }

        function unlock() {
            if (!getVolume()) {
                return false;
            }

            try {
                const context = getAudioContext();

                if (!context) {
                    return false;
                }

                if (context.state === 'suspended' && typeof context.resume === 'function') {
                    context.resume().catch(noop);
                }

                return true;
            } catch (error) {
                onError(error);
                return false;
            }
        }

        function scheduleTone(context, startAt, tone, volume) {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            const duration = Math.max(Number(tone.duration) || 0.18, 0.08);
            const peak = Math.max(volume * (Number(tone.level) || 0.11), 0.0001);

            oscillator.type = tone.wave || 'sine';
            oscillator.frequency.setValueAtTime(tone.frequency, startAt);

            if (tone.endFrequency) {
                oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, startAt + duration * 0.72);
            }

            gain.gain.setValueAtTime(0.0001, startAt);
            gain.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(0.035, duration * 0.25));
            gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(startAt);
            oscillator.stop(startAt + duration + 0.02);
        }

        function playSequence(sequence) {
            const volume = getVolume();

            if (!volume || !Array.isArray(sequence) || sequence.length === 0) {
                return false;
            }

            try {
                const context = getAudioContext();

                if (!context) {
                    return false;
                }

                const scheduleSequence = () => {
                    const startAt = context.currentTime + 0.015;
                    sequence.forEach(tone => scheduleTone(context, startAt + (tone.offset || 0), tone, volume));
                };

                if (context.state === 'suspended' && typeof context.resume === 'function') {
                    const resumed = context.resume();

                    if (resumed && typeof resumed.then === 'function') {
                        resumed.then(scheduleSequence).catch(onError);
                    } else {
                        scheduleSequence();
                    }
                } else {
                    scheduleSequence();
                }

                return true;
            } catch (error) {
                onError(error);
                return false;
            }
        }

        function playCompletion(type) {
            const baseFrequency = type === 'legendary' ? 660 : type === 'goal' ? 540 : 420;

            return playSequence([
                { frequency: baseFrequency, endFrequency: baseFrequency * 1.28, duration: 0.23, level: 0.16 }
            ]);
        }

        function playRaceCue(type) {
            if (type === 'break-start') {
                return playSequence([
                    { frequency: 659.25, endFrequency: 587.33, duration: 0.18, offset: 0, level: 0.1 },
                    { frequency: 523.25, duration: 0.24, offset: 0.16, level: 0.09 }
                ]);
            }

            if (type === 'focus-start') {
                return playSequence([
                    { frequency: 440, endFrequency: 523.25, duration: 0.17, offset: 0, level: 0.1 },
                    { frequency: 659.25, duration: 0.22, offset: 0.15, level: 0.1 }
                ]);
            }

            if (type === 'session-complete') {
                return playSequence([
                    { frequency: 523.25, duration: 0.2, offset: 0, level: 0.11 },
                    { frequency: 659.25, duration: 0.22, offset: 0.14, level: 0.11 },
                    { frequency: 783.99, duration: 0.36, offset: 0.28, level: 0.13 }
                ]);
            }

            return false;
        }

        function destroy() {
            if (audioContext && typeof audioContext.close === 'function') {
                audioContext.close().catch(noop);
            }

            audioContext = null;
        }

        return {
            unlock,
            playCompletion,
            playRaceCue,
            destroy
        };
    }

    global.TasklyzenAudio = {
        createAudioController
    };
})(typeof window !== 'undefined' ? window : globalThis);
