const { confirm: confirmPrompt } = require('@inquirer/prompts');

module.exports = async function confirm(query) {
  const response = await confirmPrompt({
    message: query.trim(),
    initial: true,
  });

  return response;
};
