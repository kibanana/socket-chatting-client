const chalk = require('chalk');

module.exports = {
    me: (message) => console.log(`\n${chalk.hex('#84B1ED').bold(message)} - ${new Date().toLocaleString()}`),
    other: (user, message) => console.log(`\n${user}: ${message} - ${new Date().toLocaleString()}`),
    systemSuccess: (message) => console.log(chalk.hex('#3AC569').bold(`\n${message}`)),
    systemError: (message) => console.log(chalk.hex('#F1404B').bold(`\n${message}`))
};
