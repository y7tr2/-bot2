const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    InteractionType 
} = require('discord.js');
const keepAlive = require('./keep_alive.js');
const { spawn } = require('child_process');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent
    ]
});

keepAlive();

let db = {
    credits: {},
    config: { 
        buyChannel: null, 
        pointPrice: 1000,
        botPrice: 5000 
    }
};

client.on('ready', () => {
    console.log(`${client.user.tag} Ready`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content.startsWith('!setup')) {
        if (!message.member.permissions.has('Administrator')) return;

        const embed = new EmbedBuilder()
            .setTitle("Bot Maker System")
            .setDescription(`Price per point: ${db.config.pointPrice}\nBot Price: ${db.config.botPrice}`)
            .setColor("Blue");

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('buy_pts').setLabel('Buy Points').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('make_bot').setLabel('Create Bot').setStyle(ButtonStyle.Primary)
        );

        message.channel.send({ embeds: [embed], components: [row] });
    }

    if (message.content === '!balance') {
        const bal = db.credits[message.author.id] || 0;
        message.reply(`Balance: ${bal}`);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'buy_pts') {
            const modal = new ModalBuilder().setCustomId('m_pts').setTitle('Buy Points');
            const input = new TextInputBuilder()
                .setCustomId('amt')
                .setLabel("Amount")
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'make_bot') {
            const bal = db.credits[interaction.user.id] || 0;
            if (bal < db.config.botPrice) return interaction.reply({ content: "Low balance", ephemeral: true });

            const modal = new ModalBuilder().setCustomId('m_bot').setTitle('Bot Token');
            const input = new TextInputBuilder()
                .setCustomId('tk')
                .setLabel("Token")
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'm_pts') {
            const amt = parseInt(interaction.fields.getTextInputValue('amt'));
            db.credits[interaction.user.id] = (db.credits[interaction.user.id] || 0) + amt;
            await interaction.reply({ content: `Added ${amt} points`, ephemeral: true });
        }

        if (interaction.customId === 'm_bot') {
            const token = interaction.fields.getTextInputValue('tk');
            db.credits[interaction.user.id] -= db.config.botPrice;

            spawn('node', ['-e', `
                const { Client } = require('discord.js');
                const c = new Client({ intents: [32767] });
                c.on('ready', () => console.log('Online'));
                c.login('${token}').catch(() => process.exit());
            `]);

            await interaction.reply({ content: "Bot is starting...", ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
