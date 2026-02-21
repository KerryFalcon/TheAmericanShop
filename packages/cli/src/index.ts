#!/usr/bin/env node

import chalk from 'chalk';

import { runAddCommand } from './commands/add';
import { runDeployCommand } from './commands/deploy';
import { runDoctorCommand } from './commands/doctor';
import { runInitCommand } from './commands/init';
import { runListCommand } from './commands/list';
import { runMapCommand } from './commands/map';
import { runRemoveCommand } from './commands/remove';
import { runTutorialCommand } from './commands/tutorial';
import { runViewCommand } from './commands/view';

function printHelp(): void {
  console.log(`\n${chalk.bold('Landmaker CLI')}\n`);
  console.log('Uso:');
  console.log(`  ${chalk.cyan('landmaker init')}  Crea o repara landmaker.config.json.`);
  console.log(`  ${chalk.cyan('landmaker list')}   Lista secciones disponibles y recomienda una estructura completa.`);
  console.log(`  ${chalk.cyan('landmaker map')}   Muestra la estructura actual de páginas y secciones.`);
  console.log(`  ${chalk.cyan('landmaker doctor')}   Diagnostica inconsistencias entre config, wrappers, registry y plantillas.`);
  console.log(`  ${chalk.cyan('landmaker deploy')}   Limpia plantillas no utilizadas y regenera artefactos para producción.`);
  console.log(`  ${chalk.cyan('landmaker tutorial')}   Abre el wizard visual de Landcelot con guía paso a paso.`);
  console.log(`  ${chalk.cyan('landmaker view <type> <variant>')}   Previsualiza una sección antes de agregarla.`);
  console.log(`  ${chalk.cyan('landmaker add <type> <variant> [theme]')}   Agrega una sección al final de home.`);
  console.log(`  ${chalk.cyan('landmaker remove <index>')}   Elimina una sección por índice (base 1).`);
}

function main(): void {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'view':
      runViewCommand(args, process.cwd());
      return;
    case 'add':
      runAddCommand(args, process.cwd());
      return;
    case 'remove':
      runRemoveCommand(args, process.cwd());
      return;
    case 'doctor':
      runDoctorCommand(process.cwd());
      return;
    case 'deploy':
      void runDeployCommand(process.cwd());
      return;
    case 'tutorial':
      void runTutorialCommand();
      return;
    case 'list':
      runListCommand(process.cwd());
      return;
    case 'init':
      runInitCommand(process.cwd());
      return;
    case 'map':
      runMapCommand(process.cwd());
      return;
    case undefined:
      printHelp();
      return;
    default:
      console.log(chalk.red(`Comando desconocido: ${command}`));
      printHelp();
  }
}

main();
