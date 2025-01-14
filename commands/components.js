exports.command = 'components <command>';
exports.describe =
  'List, drop, or reset components deployed on a HarperDB instance';
exports.builder = (yargs) => {
  return yargs.commandDir('components');
};
exports.handler = () => {};
