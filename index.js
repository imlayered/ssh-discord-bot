const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const si = require('systeminformation');
const config = require('./config.json');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

let runningProcess = null;
let runningCommandMessage = null;
let commandOutput = '';

client.once('ready', async () => {
  console.log('Bot is online!');

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(Routes.applicationCommands(client.user.id), {
      body: [
        {
          name: 'sysinfo',
          description: 'Displays all information about the bot',
        },
        {
          name: 'cmd',
          description: 'Send a command to the server and return the output',
          options: [
            {
              name: 'command',
              description: 'The command to run',
              type: 3, 
              required: true,
            },
          ],
        },
        {
          name: 'reboot',
          description: 'Reboot the server',
        },
        {
          name: 'stop',
          description: 'Stop the currently running command',
        },
      ],
    });

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user } = interaction;

  if (!config.allowedUsers.includes(user.id)) {
    return interaction.reply('You are not permitted to use the bot.');
  }

  if (commandName === 'sysinfo') {
    const cpu = await si.cpu();
    const mem = await si.mem();
    const osInfo = await si.osInfo();
    const disk = await si.fsSize();
    const bios = await si.bios();
    const packages = await si.services('*');
    
    const embed = new EmbedBuilder()
      .setTitle('System Information')
      .addFields(
        { name: 'CPU', value: `${cpu.manufacturer} ${cpu.brand}`, inline: true },
        { name: 'Core Count', value: `${cpu.cores}`, inline: true },
        { name: 'RAM', value: `Used: ${(mem.used / (1024 ** 3)).toFixed(2)} GB\nAvailable: ${(mem.available / (1024 ** 3)).toFixed(2)} GB\nTotal: ${(mem.total / (1024 ** 3)).toFixed(2)} GB`, inline: true },
        { name: 'Storage', value: `Used: ${(disk[0].used / (1024 ** 3)).toFixed(2)} GB\nAvailable: ${(disk[0].available / (1024 ** 3)).toFixed(2)} GB\nTotal: ${(disk[0].size / (1024 ** 3)).toFixed(2)} GB`, inline: true },
        { name: 'BIOS', value: `${bios.vendor} ${bios.version}`, inline: true },
        { name: 'OS', value: `${osInfo.distro} ${osInfo.release}`, inline: true },
        { name: 'Packages Installed', value: `${packages.length}`, inline: true },
      );
    await interaction.reply({ embeds: [embed] });
  } else if (commandName === 'cmd') {
    const command = options.getString('command');

    await interaction.reply(`Running command: \`${command}\``);
    runningCommandMessage = await interaction.fetchReply();
    runningCommandMessage.react('🔄');

    runningProcess = spawn(command, { shell: true });
    commandOutput = `root@system: # ${command}\n`;

    runningProcess.stdout.on('data', data => {
      commandOutput += data.toString();
    });

    runningProcess.stderr.on('data', data => {
      commandOutput += data.toString();
    });

    runningProcess.on('close', code => {
      runningCommandMessage.reactions.removeAll();
      interaction.followUp(`\`\`\`text\n${commandOutput}\n\`\`\``);
      runningProcess = null;
      runningCommandMessage = null;
    });
  } else if (commandName === 'stop') {
    if (runningProcess) {
      runningProcess.kill('SIGINT');
      await interaction.reply(`\`\`\`text\n${commandOutput}\n^C\n\`\`\``);
      runningProcess = null;
      runningCommandMessage = null;
    } else {
      return interaction.reply('No command is currently running.');
    }
  } else if (commandName === 'reboot') {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('confirm-reboot')
          .setLabel('Confirm Reboot')
          .setStyle(ButtonStyle.Danger),
      );

    await interaction.reply({ content: 'Are you sure you want to reboot the server?', components: [row] });
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'confirm-reboot') {
    await interaction.reply('Rebooting server...');
    exec('sudo reboot', (error, stdout, stderr) => {
      if (error) {
        return interaction.followUp(`Error: ${error.message}`);
      }
      if (stderr) {
        return interaction.followUp(`Stderr: ${stderr}`);
      }
      interaction.followUp(`Output: ${stdout}`);
    });
  }
});

client.login(config.token);
