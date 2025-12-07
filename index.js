require('dotenv').config();
const { Client, GatewayIntentBits, Events, AttachmentBuilder, REST, Routes, SlashCommandBuilder, MessageFlags } = require('discord.js');
const screenshot = require('screenshot-desktop');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
    new SlashCommandBuilder()
        .setName('screenshot')
        .setDescription('Take a screenshot of your monitor(s)')
        .addStringOption(option =>
            option.setName('monitor')
                .setDescription('Specify monitor number')
                .setAutocomplete(true)
                .setRequired(false)
        )
        .toJSON()
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        console.log('Slash commands registered.');
    } catch (err) {
        console.error('Failed to register commands:', err);
    }
}

function getTimestamp() {
    const now = new Date();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `[${hours}:${minutes}:${seconds}]`;
}

client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();

    // Leave all other guilds
    client.guilds.cache.forEach(guild => {
        if (guild.id !== process.env.GUILD_ID) {
            console.log(`Leaving unauthorized guild: ${guild.name}`);
            guild.leave();
        }
    });
});

client.on(Events.GuildCreate, guild => {
    if (guild.id !== process.env.GUILD_ID) {
        console.log(`Joined unauthorized guild: ${guild.name}, leaving...`);
        await guild.leave();
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.user.id != process.env.OWNER_ID) {
        await interaction.reply({ content: 'You do not have permission to use this.', flags: [MessageFlags.Ephemeral] });
        console.log(`${getTimestamp()} @${interaction.user.username} tried to use /screenshot`);
        return;
    }
    if (interaction.isAutocomplete()) {
        const focusedOption = interaction.options.getFocused(true);

        if (interaction.commandName === 'screenshot' && focusedOption.name === 'monitor') {
            try {
                const displays = await screenshot.listDisplays();
                const choices = displays.map((_, index) => ({
                    name: `Monitor ${index + 1}`,
                    value: `${index + 1}`
                }));

                choices.unshift({ name: 'All Monitors', value: 'all' });

                await interaction.respond(choices.slice(0, 25));
            } catch (err) {
                console.error('Error listing monitors:', err);
                await interaction.respond([]);
            }
        }
        return;
    }

    await interaction.deferReply();
    const monitorOption = interaction.options.getString('monitor');

    try {
        let images;

        if (monitorOption && monitorOption.toLowerCase() !== 'all') {
            const index = parseInt(monitorOption) - 1;
            if (isNaN(index)) throw new Error('Invalid monitor number.');
            images = [await screenshot({ screen: index })];
        } else {
            images = await screenshot.all();
        }

        const attachments = images.map((img, i) =>
            new AttachmentBuilder(img).setName(`monitor_${i + 1}.png`)
        );

        await interaction.editReply({ files: attachments });
    } catch (err) {
        console.error(err);
        await interaction.editReply('Failed to capture screenshot.');
    }

    console.log(`${getTimestamp()} Sent screenshots requested by @${interaction.user.username}`)
});

client.login(process.env.DISCORD_TOKEN);
