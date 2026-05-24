const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const stockPath = path.join(__dirname, 'stock.json');

if (!fs.existsSync(stockPath) || fs.statSync(stockPath).size === 0) {
    const initialStock = { roblox: [], tiktok: [], snapchat: [], discord: [] };
    fs.writeFileSync(stockPath, JSON.stringify(initialStock, null, 4));
}

function getStock() {
    try {
        return JSON.parse(fs.readFileSync(stockPath, 'utf8'));
    } catch (e) {
        return { roblox: [], tiktok: [], snapchat: [], discord: [] };
    }
}

function saveStock(data) {
    fs.writeFileSync(stockPath, JSON.stringify(data, null, 4));
}

client.once('ready', async () => {
    const commands = [
        {
            name: 'setup',
            description: 'setup'
        },
        {
            name: 'stock',
            description: 'stock'
        },
        {
            name: 'add',
            description: 'add',
            options: [
                {
                    name: 'service',
                    description: 'service',
                    type: 3,
                    required: true,
                    choices: [
                        { name: 'Roblox', value: 'roblox' },
                        { name: 'TikTok', value: 'tiktok' },
                        { name: 'Snapchat', value: 'snapchat' },
                        { name: 'Discord', value: 'discord' }
                    ]
                },
                {
                    name: 'account',
                    description: 'account',
                    type: 3,
                    required: true
                }
            ]
        }
    ];
    await client.application.commands.set(commands);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('gen_')) return;

    const service = customId.split('_')[1];
    await interaction.deferReply({ ephemeral: true });

    let stock = getStock();

    if (!stock[service] || stock[service].length === 0) {
        return await interaction.followup.send({ content: `❌ المخزون فارغ`, ephemeral: true });
    }

    const account = stock[service].shift();
    saveStock(stock);

    const embed = new EmbedBuilder()
        .setTitle('✅ تم التوليد')
        .setColor(0x2f3136)
        .addFields(
            { name: 'الخدمة', value: `\`${service.toUpperCase()}\``, inline: false },
            { name: 'الحساب', value: `\`\`\`\n${account}\n\`\`\``, inline: false }
        );

    try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.followup.send({ content: `📥 تفقد الخاص`, ephemeral: true });
    } catch (error) {
        stock = getStock();
        stock[service].unshift(account);
        saveStock(stock);
        await interaction.followup.send({ content: '⚠️ الخاص مغلق', ephemeral: true });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setup') {
        if (interaction.user.id !== ADMIN_ID) return;

        const embed = new EmbedBuilder()
            .setTitle('🚀 توزيع الحسابات')
            .setDescription('اضغط على الزر بالأسفل')
            .setColor(0x5865f2);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gen_roblox').setLabel('Roblox 🎮').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_tiktok').setLabel('TikTok 🎵').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_snapchat').setLabel('Snapchat 👻').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_discord').setLabel('Discord 💎').setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅', ephemeral: true });
    }

    if (commandName === 'add') {
        if (interaction.user.id !== ADMIN_ID) return;

        const service = interaction.options.getString('service');
        const account = interaction.options.getString('account');

        const stock = getStock();
        stock[service].push(account);
        saveStock(stock);

        await interaction.reply({ content: `✅ تم المضافة`, ephemeral: true });
    }

    if (commandName === 'stock') {
        const stock = getStock();
        const embed = new EmbedBuilder()
            .setTitle('📦 المخزون')
            .setColor(0x2ecc71);

        for (const [service, accounts] of Object.entries(stock)) {
            embed.addFields({ name: service.toUpperCase(), value: `\`${accounts.length}\``, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
  
