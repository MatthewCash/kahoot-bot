import axios from 'axios';
import ws from 'ws';
import atob from 'atob';

// Functions taken (and slightly modified) from Kahoot's Site
const decodeSessionToken = (sessionToken, message, offsetEquation) => {
    const answer = reserveChallengeToAnswer(message, offsetEquation);
    return xorString(atob(sessionToken), answer);
};

const xorString = (e, t) => {
    for (var n = '', a = 0; a < e.length; a++) {
        const o = e.charCodeAt(a) ^ t.charCodeAt(a % t.length);
        n += String.fromCharCode(o);
    }
    return n;
};
const reserveChallengeToAnswer = (message, offsetEquation) => {
    return message.replace(/./g, function (_char, position) {
        return String.fromCharCode(
            ((_char.charCodeAt(0) * position +
                Function('return ' + offsetEquation)()) %
                77) +
                48
        );
    });
};
// End Functions taken (and slightly modified) from Kahoot's Site

const startBot = async (name, code) => {
    // Get session token and random stuff
    const res = await axios
        .get(
            `https://kahoot.it/reserve/session/${code}/?${new Date().getTime()}`
        )
        .catch(error => {
            if (error.response.status === 503) {
                // Rate Limited (Probably)
                console.log('ERROR: (Most Likely Rate Limited)');
            } else {
                console.log(error);
            }
        });

    // Exit Current Client if no response (or error)
    if (!res) return;

    // Get session token and random stuff from response
    const sessionToken = res.headers['x-kahoot-session-token'];

    const challengeLocation = res.data.challenge.search("'");
    const challenge = res.data.challenge
        .substr(challengeLocation)
        .split("'")[1];

    const equationLocation = res.data.challenge.search('=');
    const equation = res.data.challenge
        .substr(equationLocation + 2)
        .split(';')[0];

    // Use Kahoot's decodeSessionToken() function
    const sessionId = decodeSessionToken(sessionToken, challenge, equation);

    // Open WebSocket Connection with sessionID from above
    const client = new ws(`wss://kahoot.it/cometd/${code}/${sessionId}`);

    // Rate Limit Detection
    client.on('error', async error => {
        console.log('Received WS Error');
        console.log(error);
    });

    // Wait for WebSocket to Connect
    await new Promise(r => client.once('open', r));
    // Send handshake to get clientId
    client.send(
        JSON.stringify([
            {
                id: '1',
                version: '1.0',
                minimumVersion: '1.0',
                channel: '/meta/handshake',
                supportedConnectionTypes: [
                    'websocket',
                    'long-polling',
                    'callback-polling'
                ],
                advice: { timeout: 60000, interval: 0 },
                ext: {
                    ack: true,
                    timesync: { tc: 1589218987333, l: 0, o: 0 }
                }
            }
        ])
    );

    // Get ClientID and TC (idk what TC is, probably some timezone stuff, might be useless)
    const { clientId, tc } = await new Promise((resolve, reject) => {
        client.once('message', message => {
            const data = JSON.parse(message);
            resolve({
                clientId: data[0].clientId,
                tc: data[0].ext.timesync.tc
            });
        });
    });

    // Probably a keep alive, not sure
    client.send(
        JSON.stringify([
            {
                id: '2',
                channel: '/meta/connect',
                connectionType: 'websocket',
                advice: { timeout: 0 },
                clientId,
                ext: { ack: 0, timesync: { tc, l: 83, o: 107 } }
            }
        ])
    );

    // Wait for a message
    await new Promise((resolve, reject) => {
        client.once('message', message => {
            resolve();
        });
    });

    // Probably another keep alive
    await client.send(
        JSON.stringify([
            {
                id: '3',
                channel: '/meta/connect',
                connectionType: 'websocket',
                clientId,
                ext: { ack: 1, timesync: { tc, l: 83, o: 107 } }
            }
        ])
    );

    // This delay is important, otherwise it won't acknowledge the next request
    await new Promise(r => setTimeout(r, 1000));

    // Connect to the Game
    client.send(
        JSON.stringify([
            {
                id: '4',
                channel: '/service/controller',
                data: {
                    type: 'login',
                    gameid: code,
                    host: 'kahoot.it',
                    name,
                    content: `{"device":{"userAgent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36","screen":{"width":2560,"height":1440}}}`
                },
                clientId,
                ext: {}
            }
        ])
    );

    // Send Keep Alive (???) every 10 seconds
    setInterval(() => {
        client.send(
            JSON.stringify([
                {
                    id: '47',
                    channel: '/meta/connect',
                    connectionType: 'websocket',
                    clientId,
                    ext: {
                        ack: 44,
                        timesync: { tc, l: 117, o: 185 }
                    }
                }
            ])
        );
    }, 10000);
};

// Run the bots
export const run = async (
    code: number,
    name: (count) => string,
    max: number
) => {
    for (let count = 0; count < 1000 && count < max; count++) {
        startBot(name(count + 1), code);

        // Only Log if divisible by logInterval
        console.log(`Starting Bot ${name(count + 1)}...`);

        // It will not work without a slight delay, 25ms seems to be fast without spitting errors
        await new Promise(r => setTimeout(r, 25));
    }
};
