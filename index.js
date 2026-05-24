const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// جلب التوكن والأيدي تلقائياً من ريندر لحماية بياناتك
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
    console.log(`✅ ${client.user.tag}`);
    
    const commands = [
        {
            name: 'setup',
            description: 'إرسال لوحة التحكم بالتوزيع للأعضاء'
        },
        {
            name: 'stock',
            description: 'استعراض كمية الحسابات المتوفرة'
        },
        {
            name: 'add',
            description: 'إضافة حسابات جديدة للمخزن',
            options: [
                {
                    name: 'service',
                    description: 'اختر الخدمة',
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
                    description: 'الحساب المراد إضافته (user:pass)',
                    type: 3,
                    required: true
                }
            ]
        }
    ];

    try {
        await client.application.commands.set(commands);
    } catch (err) {
        console.error("Error registering commands:", err);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;
    if (!customId.startsWith('gen_')) return;

    const service = customId.split('_')[1];
    await interaction.deferReply({ ephemeral: true });

    let stock = getStock();

    if (!stock[service] || stock[service].length === 0) {
        return await interaction.followup.send({ content: `❌ مخزون **${service.toUpperCase()}** فارغ حالياً!`, ephemeral: true });
    }

    const account = stock[service].shift();
    saveStock(stock);

    const embed = new EmbedBuilder()
        .setTitle('✅ تم توليد الحساب بنجاح!')
        .setColor(0x2f3136)
        .addFields(
            { name: 'الخدمة', value: `\`${service.toUpperCase()}\``, inline: false },
            { name: 'الحساب', value: `\`\`\`\n${account}\n\`\`\``, inline: false }
        )
        .setFooter({ text: '🔒 نظام محمي ومضمون 100%' });

    try {
        await interaction.user.send({ embeds: [embed] });
        await interaction.followup.send({ content: `📥 تم إرسال حساب **${service.toUpperCase()}** في الخاص بنجاح!`, ephemeral: true });
    } catch (error) {
        stock = getStock();
        stock[service].unshift(account);
        saveStock(stock);
        await interaction.followup.send({ content: '⚠️ حسابك لم يضع! ولكن رسائلك الخاصة مغلقة. افتح الخاص في السيرفر وأعد الضغط على الزر.', ephemeral: true });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setup') {
        if (interaction.user.id !== ADMIN_ID) {
            return await interaction.reply({ content: '❌ هذا الأمر مخصص للمطور فقط!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🚀 نظام توزيع الحسابات التلقائي')
            .setDescription('اختر الخدمة المطلوبة من الأزرار بالأسفل وسيتم إرسال الحساب لك مباشرة في الخاص.')
            .setColor(0x5865f2);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('gen_roblox').setLabel('Roblox 🎮').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_tiktok').setLabel('TikTok 🎵').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_snapchat').setLabel('Snapchat 👻').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gen_discord').setLabel('Discord 💎').setStyle(ButtonStyle.Secondary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ تم إرسال لوحة التحكم بنجاح!', ephemeral: true });
    }

    if (commandName === 'add') {
        if (interaction.user.id !== ADMIN_ID) {
            return await interaction.reply({ content: '❌ هذا الأمر مخصص للمطور فقط!', ephemeral: true });
        }

        const service = interaction.options.getString('service');
        const account = interaction.options.getString('account');

        const stock = getStock();
        stock[service].push(account);
        saveStock(stock);

        await interaction.reply({ content: `✅ تمت إضافة الحساب بنجاح إلى مخزون **${service.toUpperCase()}**.`, ephemeral: true });
    }

    if (commandName === 'stock') {
        const stock = getStock();
        const embed = new EmbedBuilder()
            .setTitle('📦 حالة المخزون الحالي')
            .setColor(0x2ecc71);

        for (const [service, accounts] of Object.entries(stock)) {
            embed.addFields({ name: service.toUpperCase(), value: `\`${accounts.length}\` حساب متوفر`, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    }
});

client.login(TOKEN);
          
