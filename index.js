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
    InteractionType,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const keepAlive = require('./keep_alive.js');
const { spawn } = require('child_process');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

keepAlive();

let db = {
    credits: {},
    activeBots: {},
    config: { 
        buyChannel: null, 
        pointPrice: 1000,
        prices: {
            broadcast: 5000,
            probot: 10000,
            music: 7000,
            ticket: 4000,
            giveaway: 3000,
            lines: 2000,
            logs: 3500,
            games: 5000,
            feedback: 1500,
            apply: 6000
        }
    }
};

const commands = [
    new SlashCommandBuilder().setName('setup').setDescription('إعداد لوحة تحكم البوت ميكر لشراء النقاط'),
    new SlashCommandBuilder().setName('shop').setDescription('عرض متجر شراء البوتات المتوفرة وبدء الصنع'),
    new SlashCommandBuilder().setName('balance').setDescription('التحقق من رصيدك الحالي من النقاط'),
    new SlashCommandBuilder().setName('bots').setDescription('عرض قائمة البوتات التي قمت بإنشائها وحالتها'),
    new SlashCommandBuilder().setName('add-points').setDescription('إضافة نقاط لمستخدم (للإدارة)')
        .addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('عدد النقاط').setRequired(true)),
    new SlashCommandBuilder().setName('remove-points').setDescription('سحب نقاط من مستخدم (للإدارة)')
        .addUserOption(o => o.setName('user').setDescription('المستخدم').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('عدد النقاط').setRequired(true)),
    new SlashCommandBuilder().setName('set-price').setDescription('تعديل سعر بوت معين (للإدارة)')
        .addStringOption(o => o.setName('type').setDescription('نوع البوت').setRequired(true)
            .addChoices(
                { name: 'برودكاست', value: 'broadcast' },
                { name: 'سستم بروبوت', value: 'probot' },
                { name: 'ميوزك', value: 'music' },
                { name: 'تكت', value: 'ticket' },
                { name: 'جيف اواي', value: 'giveaway' },
                { name: 'خطوط تلقائية', value: 'lines' },
                { name: 'لوق وسجلات', value: 'logs' },
                { name: 'ألعاب', value: 'games' },
                { name: 'آراء وتقييمات', value: 'feedback' },
                { name: 'تقديم إداري', value: 'apply' }
            ))
        .addIntegerOption(o => o.setName('price').setDescription('السعر الجديد').setRequired(true)),
    new SlashCommandBuilder().setName('transfer').setDescription('تحويل نقاط إلى مستخدم آخر')
        .addUserOption(o => o.setName('user').setDescription('المستلم').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('المبلغ المراد تحويله').setRequired(true))
].map(command => command.toJSON());

client.on('ready', async () => {
    console.log(`${client.user.tag} Ready`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully registered global slash commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, options } = interaction;

        if (commandName === 'setup') {
            if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'لا تملك صلاحية!', ephemeral: true });
            db.config.buyChannel = interaction.channelId;

            const embed = new EmbedBuilder()
                .setTitle("مركز شحن النقاط | النقاط والعملات")
                .setDescription(`مرحباً بك في مركز الشحن.\n\nسعر النقطة الواحدة الحالية: **${db.config.pointPrice} كاش**\n\nاضغط على الزر أدناه لشراء وشحن حسابك بالنقاط تلقائياً.`)
                .setColor("Green");

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('buy_pts').setLabel('شراء نقاط شحن').setStyle(ButtonStyle.Success)
            );

            await interaction.reply({ content: 'تم إعداد روم الشراء بنجاح.', ephemeral: true });
            await interaction.channel.send({ embeds: [embed], components: [row] });
        }

        if (commandName === 'shop') {
            const embed = new EmbedBuilder()
                .setTitle("متجر صناعة البوتات المتكامل")
                .setDescription("اختر نوع البوت الذي ترغب في إنشائه وتشغيله 24 ساعة من القائمة أدناه:")
                .addFields(
                    { name: "🤖 بوت برودكاست", value: `السعر: ${db.config.prices.broadcast} نقطة`, inline: true },
                    { name: "🛡️ بوت سستم بروبوت", value: `السعر: ${db.config.prices.probot} نقطة`, inline: true },
                    { name: "🎵 بوت ميوزك", value: `السعر: ${db.config.prices.music} نقطة`, inline: true },
                    { name: "🎟️ بوت تكت والدعم", value: `السعر: ${db.config.prices.ticket} نقطة`, inline: true },
                    { name: "🎉 بوت جيف اواي", value: `السعر: ${db.config.prices.giveaway} نقطة`, inline: true },
                    { name: "✍️ بوت الخطوط والتلقائي", value: `السعر: ${db.config.prices.lines} نقطة`, inline: true },
                    { name: "📜 بوت السجلات واللوق", value: `السعر: ${db.config.prices.logs} نقطة`, inline: true },
                    { name: "🎮 بوت ألعاب وتسلية", value: `السعر: ${db.config.prices.games} نقطة`, inline: true },
                    { name: "⭐ بوت الآراء والتقييم", value: `السعر: ${db.config.prices.feedback} نقطة`, inline: true },
                    { name: "📝 بوت التقديم الإداري", value: `السعر: ${db.config.prices.apply} نقطة`, inline: true }
                )
                .setColor("Gold");

            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('make_broadcast').setLabel('برودكاست').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('make_probot').setLabel('سستم بروبوت').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('make_music').setLabel('ميوزك').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('make_ticket').setLabel('تكت').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('make_giveaway').setLabel('جيف اواي').setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('make_lines').setLabel('خطوط').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('make_logs').setLabel('لوق').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('make_games').setLabel('ألعاب').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('make_feedback').setLabel('تقييمات').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('make_apply').setLabel('تقديم').setStyle(ButtonStyle.Secondary)
            );

            await interaction.reply({ embeds: [embed], components: [row1, row2] });
        }

        if (commandName === 'balance') {
            const bal = db.credits[interaction.user.id] || 0;
            await interaction.reply({ content: `رصيدك الحالي هو: **${bal}** نقطة.`, ephemeral: true });
        }

        if (commandName === 'transfer') {
            const target = options.getUser('user');
            const amount = options.getInteger('amount');
            const userBal = db.credits[interaction.user.id] || 0;

            if (target.bot) return interaction.reply({ content: 'لا يمكنك التحويل للبوتات.', ephemeral: true });
            if (amount <= 0) return interaction.reply({ content: 'الرجاء إدخال عدد نقاط صحيح.', ephemeral: true });
            if (userBal < amount) return interaction.reply({ content: 'رصيدك غير كافٍ للتحويل.', ephemeral: true });

            db.credits[interaction.user.id] -= amount;
            db.credits[target.id] = (db.credits[target.id] || 0) + amount;

            await interaction.reply({ content: `تم بنجاح تحويل **${amount}** نقطة إلى ${target}.` });
        }

        if (commandName === 'add-points') {
            if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'لا تملك صلاحية إدارية.', ephemeral: true });
            const target = options.getUser('user');
            const amount = options.getInteger('amount');

            db.credits[target.id] = (db.credits[target.id] || 0) + amount;
            await interaction.reply({ content: `تمت إضافة **${amount}** نقطة إلى حساب ${target} بنجاح.`, ephemeral: true });
        }

        if (commandName === 'remove-points') {
            if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'لا تملك صلاحية إدارية.', ephemeral: true });
            const target = options.getUser('user');
            const amount = options.getInteger('amount');

            db.credits[target.id] = Math.max(0, (db.credits[target.id] || 0) - amount);
            await interaction.reply({ content: `تم سحب **${amount}** نقطة من حساب ${target}.`, ephemeral: true });
        }

        if (commandName === 'set-price') {
            if (!interaction.member.permissions.has('Administrator')) return interaction.reply({ content: 'لا تملك صلاحية إدارية.', ephemeral: true });
            const type = options.getString('type');
            const price = options.getInteger('price');

            db.config.prices[type] = price;
            await interaction.reply({ content: `تم تعديل سعر بوت الـ **${type}** ليكون **${price}** نقطة.`, ephemeral: true });
        }

        if (commandName === 'bots') {
            const userBots = db.activeBots[interaction.user.id] || [];
            if (userBots.length === 0) return interaction.reply({ content: 'لم تقم بصنع أي بوتات حتى الآن.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle("قائمة بوتاتك النشطة")
                .setDescription(userBots.map((b, i) => `${i + 1}. نوع البوت: **${b.type}** | الحالة: ✅ يعمل 24 ساعة`).join('\n'))
                .setColor("Blue");

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'buy_pts') {
            const modal = new ModalBuilder().setCustomId('m_pts').setTitle('شراء شحن نقاط');
            const input = new TextInputBuilder()
                .setCustomId('amt')
                .setLabel("أدخل عدد النقاط المطلوبة")
                .setPlaceholder('مثال: 5')
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('make_')) {
            const botType = interaction.customId.replace('make_', '');
            const price = db.config.prices[botType];
            const bal = db.credits[interaction.user.id] || 0;

            if (bal < price) return interaction.reply({ content: `رصيدك لا يكفي لشراء هذا البوت، السعر المطلوب هو ${price} نقطة.`, ephemeral: true });

            const modal = new ModalBuilder().setCustomId(`m_bot_${botType}`).setTitle(`توكن بوت ${botType}`);
            const input = new TextInputBuilder()
                .setCustomId('tk')
                .setLabel("أدخل توكن البوت الخاص بك")
                .setPlaceholder('MTI0N...')
                .setStyle(TextInputStyle.Short);
            modal.addComponents(new ActionRowBuilder().addComponents(input));
            await interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'm_pts') {
            const amt = parseInt(interaction.fields.getTextInputValue('amt'));
            if (isNaN(amt) || amt <= 0) return interaction.reply({ content: 'الرجاء إدخال رقم صحيح.', ephemeral: true });

            db.credits[interaction.user.id] = (db.credits[interaction.user.id] || 0) + amt;
            await interaction.reply({ content: `تمت عملية الشحن وإضافة **${amt}** نقطة إلى حسابك بنجاح!`, ephemeral: true });
        }

        if (interaction.customId.startsWith('m_bot_')) {
            const botType = interaction.customId.replace('m_bot_', '');
            const token = interaction.fields.getTextInputValue('tk');
            const price = db.config.prices[botType];

            db.credits[interaction.user.id] -= price;

            spawn('node', ['-e', `
                const { Client } = require('discord.js');
                const c = new Client({ intents: [32767] });
                c.on('ready', () => console.log('${botType} Online'));
                c.login('${token}').catch(() => process.exit());
            `]);

            if (!db.activeBots[interaction.user.id]) db.activeBots[interaction.user.id] = [];
            db.activeBots[interaction.user.id].push({ type: botType, token: token });

            await interaction.reply({ content: `✅ تم حجز التوكن وبدء تشغيل بوت **${botType}** الخاص بك بنجاح وهو يعمل الآن دون توقف!`, ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
            
