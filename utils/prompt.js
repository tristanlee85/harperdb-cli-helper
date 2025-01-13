import prompts from 'prompts';

export async function prompt(query) {
  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: query.trim(),
    initial: true,
  });

  return response.confirm;
}
