const { initialize } = require('../utils/configManager.js');

exports.command = 'init';
exports.describe = 'Initialize the .env.hdb file with default values';

exports.handler = () => {
  initialize();
};
