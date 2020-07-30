import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

import { run } from './spammer';

const app = express();

app.use(bodyParser.json());

app.use(
    cors({
        origin(origin, callback) {
            return callback(null, true);
        }
    })
);

app.route('/launch').post(async (req, res) => {
    if (req.body?.authToken !== process.env.LAUNCH_TOKEN) {
        return res.status(401).json({
            success: false,
            message: 'Missing Authorization for Launch!'
        });
    }

    if (!req.body.code || !req.body.name || !req.body.count) {
        return res.status(400).json({
            success: false,
            message: 'Missing Required Parameters!'
        });
    }

    const name = count => `${req.body.name} ${count}`;

    run(req.body.code, name, req.body.count);

    res.status(200).json({
        success: true,
        message: 'Bots Launched!'
    });
});

const main = () => {
    const host = process.env.HOST ?? '127.0.0.1';
    const port = process.env.PORT ?? 4056;

    app.listen(port, host);

    console.log('[Ready] Server Listening!');
};

main();
