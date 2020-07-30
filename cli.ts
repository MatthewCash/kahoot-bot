import { run } from './spammer';

const main = async (code?, name = 'Kahoot', max = 10) => {
    if (!code) return console.error('No code was provided!');
    const nameFunc = count => `${name} ${count}`;

    await run(code, nameFunc, max);

    console.log(
        `Finished sending ${max} bots, exit program ^C to disconnect bots`
    );
};

main(...process.argv.splice(2));
