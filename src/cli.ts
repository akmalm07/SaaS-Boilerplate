#!/usr/bin/env node
import { confirm, intro, isCancel, outro, select, text } from '@clack/prompts';
import { Command } from 'commander';
import { generateProject } from './core/generate.js';
import { configFromOptions } from './core/validate.js';
import {
  backends,
  databases,
  emails,
  frontends,
  isBetaSelection,
  storages,
  type GeneratorConfig,
  type SelectionKind,
} from './core/types.js';

const choices = (kind: SelectionKind, values: readonly string[]) =>
  values.map((value) => ({
    value,
    label: `${value}${isBetaSelection(kind, value) ? ' (beta)' : ''}`,
  }));

function cancel(): never {
  outro('Cancelled.');
  process.exit(0);
}

async function promptConfig(projectName: string): Promise<GeneratorConfig> {
  intro('Create composable SaaS');
  const ask = async <T extends string>(
    message: string,
    kind: SelectionKind,
    options: readonly T[],
  ): Promise<T> => {
    const result = await select({ message, options: choices(kind, options) });
    return isCancel(result) ? cancel() : (result as T);
  };
  const name =
    projectName ||
    ((await text({
      message: 'Project name',
      placeholder: 'my-saas',
      validate: (value) =>
        /^[a-z0-9][a-z0-9-]{0,62}$/.test(value) ? undefined : 'Use lowercase kebab-case.',
    })) as string);
  const yesNo = async (message: string): Promise<boolean> => {
    const result = await confirm({ message, initialValue: false });
    return isCancel(result) ? cancel() : result;
  };

  return configFromOptions(name, {
    backend: await ask('Choose your backend language', 'backend', backends),
    frontend: await ask('Choose your frontend', 'frontend', frontends),
    database: await ask('Choose your database', 'database', databases),
    storage: await ask('Choose your file storage', 'storage', storages),
    email: await ask('Choose your email provider', 'email', emails),
    billing: await yesNo('Include Stripe billing? (beta)'),
    organizations: await yesNo('Include organizations/teams? (beta)'),
    docker: await yesNo('Include Docker configuration? (beta)'),
  });
}

const program = new Command();
program
  .name('create-saas')
  .argument('[project-name]')
  .option('--backend <backend>')
  .option('--frontend <frontend>')
  .option('--database <database>')
  .option('--storage <storage>')
  .option('--email <email>')
  .option('--billing')
  .option('--organizations')
  .option('--docker')
  .option('--install', 'Reserved for package install post-generation')
  .action(async (projectName, options) => {
    try {
      const supplied = [
        options.backend,
        options.frontend,
        options.database,
        options.storage,
        options.email,
      ].some(Boolean);
      const config = supplied
        ? configFromOptions(projectName, options)
        : await promptConfig(projectName);
      const destination = await generateProject(config);

      outro(
        `Generated ${destination}\n\nNext: cd ${config.projectName}, copy .env.example to .env, then install dependencies in frontend and backend.`,
      );
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program.parseAsync();
