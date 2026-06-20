const {
    Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder,
    ButtonStyle, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── بيانات الاتصال ─────────────────────────────────────────────
const TOKEN    = process.env.TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;

// ─── المستخدمون المسموح لهم بإضافة النقاط ──────────────────────
const POINTS_ADMINS = ['1n7g', 'y.7tr2'];
const canAddPoints = user => user.id === ADMIN_ID || POINTS_ADMINS.includes(user.username);

// ─── مسارات الملفات ──────────────────────────────────────────────
const stockPath  = path.join(__dirname, 'stock.json');
const pointsPath = path.join(__dirname, 'points.json');
const pricesPath = path.join(__dirname, 'prices.json');

// ─── تهيئة الملفات عند الغياب ────────────────────────────────────
if (!fs.existsSync(stockPath)  || fs.statSync(stockPath).size  === 0)
    fs.writeFileSync(stockPath,  JSON.stringify({}, null, 4));
if (!fs.existsSync(pointsPath) || fs.statSync(pointsPath).size === 0)
    fs.writeFileSync(pointsPath, JSON.stringify({}, null, 4));
if (!fs.existsSync(pricesPath) || fs.statSync(pricesPath).size === 0)
    fs.writeFileSync(pricesPath, JSON.stringify({}, null, 4));

// ─── دوال القراءة / الكتابة ──────────────────────────────────────
const getStock  = () => { try { return JSON.parse(fs.readFileSync(stockPath,  'utf8')); } catch { return {}; } };
const getPoints = () => { try { return JSON.parse(fs.readFileSync(pointsPath, 'utf8')); } catch { return {}; } };
const getPrices = () => { try { return JSON.parse(fs.readFileSync(pricesPath, 'utf8')); } catch { return {}; } };

const saveStock  = d => fs.writeFileSync(stockPath,  JSON.stringify(d, null, 4));
const savePoints = d => fs.writeFileSync(pointsPath, JSON.stringify(d, null, 4));
const savePrices = d => fs.writeFileSync(pricesPath, JSON.stringify(d, null, 4));

const getUserPoints = uid => { const p = getPoints(); return p[uid] ?? 0; };
const addUserPoints = (uid, n) => {
    const p = getPoints();
    p[uid] = (p[uid] ?? 0) + n;
    savePoints(p);
    return p[uid];
};
const deductUserPoints = (uid, n) => {
    const p = getPoints();
    if ((p[uid] ?? 0) < n) return false;
    p[uid] -= n;
    savePoints(p);
    return true;
};

// ─── بناء البانل (embed + أزرار) ─────────────────────────────────
function buildPanel() {
    const stock  = getStock();
    const prices = getPrices();
    const types  = Object.keys(prices);

    const embed = new EmbedBuilder()
        .setTitle('🏪 متجر الحسابات')
        .setColor(0x5865F2)
        .setDescription(
            '> اضغط على نوع الحساب الذي تريده\n' +
            '> يجب أن تملك النقاط الكافية قبل الشراء\n\n' +
            '**كيف تشتري نقاط؟**\n' +
            '> ١- افتح تكت وقول "أبي نقاط"\n' +
            '> ٢- كل نقطة بسعرها المحدد\n\n' +
            '**بعد الشراء:**\n' +
            '> البوت يرسل لك الحساب بالخاص فوراً'
        );

    if (types.length === 0) {
        embed.addFields({ name: '📦 الأنواع', value: '`لا توجد أنواع بعد`' });
    } else {
        const lines = types.map(t => {
            const qty   = stock[t]?.length ?? 0;
            const price = prices[t];
            const status = qty > 0 ? `✅ متوفر (${qty})` : '❌ نافد';
            return `**${t}** — ${price} نقطة — ${status}`;
        });
        embed.addFields({ name: '📋 الأنواع المتاحة', value: lines.join('\n') });
    }

    embed.setFooter({ text: 'Crown Market • لأي استفسار افتح تكت' });

    // الأزرار — صفوف بحد أقصى 5 أزرار لكل صف
    const rows = [];
    for (let i = 0; i < types.length; i += 5) {
        const chunk = types.slice(i, i + 5);
        const row   = new ActionRowBuilder().addComponents(
            chunk.map(t => {
                const qty = stock[t]?.length ?? 0;
                return new ButtonBuilder()
                    .setCustomId(`buy_${t}`)
                    .setLabel(`${t} • ${prices[t]}🪙`)
                    .setStyle(qty > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                    .setDisabled(qty === 0);
            })
        );
        rows.push(row);
    }

    return { embed, rows };
}

// ─── بناء البوت ──────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ]
});

// ─── تسجيل الأوامر Slash ─────────────────────────────────────────
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} جاهز`);

    const commands = [
        new SlashCommandBuilder()
            .setName('setup')
            .setDescription('أرسل بانل الحسابات في القناة الحالية'),

        new SlashCommandBuilder()
            .setName('stock')
            .setDescription('عرض عدد الحسابات المتاحة'),

        new SlashCommandBuilder()
            .setName('add')
            .setDescription('أضف حساب لنوع معين')
            .addStringOption(o => o.setName('نوع').setDescription('اسم النوع').setRequired(true))
            .addStringOption(o => o.setName('حساب').setDescription('يوزر:باس').setRequired(true)),

        new SlashCommandBuilder()
            .setName('addtype')
            .setDescription('أضف نوع حساب جديد وحدد سعره بالنقاط')
            .addStringOption(o => o.setName('نوع').setDescription('اسم النوع مثال: Roblox').setRequired(true))
            .addIntegerOption(o => o.setName('سعر').setDescription('السعر بالنقاط').setRequired(true).setMinValue(1)),

        new SlashCommandBuilder()
            .setName('removetype')
            .setDescription('احذف نوع حساب')
            .addStringOption(o => o.setName('نوع').setDescription('اسم النوع').setRequired(true)),

        new SlashCommandBuilder()
            .setName('points')
            .setDescription('اعرض نقاطك أو نقاط مستخدم')
            .addUserOption(o => o.setName('مستخدم').setDescription('المستخدم (اختياري)')),

        new SlashCommandBuilder()
            .setName('removeaccount')
            .setDescription('احذف حساب من المخزون')
            .addStringOption(o => o.setName('نوع').setDescription('اسم النوع').setRequired(true))
            .addIntegerOption(o => o.setName('رقم').setDescription('رقم الحساب (1 = الأول)').setRequired(true).setMinValue(1)),
    ].map(c => c.toJSON());

    try {
        await client.application.commands.set(commands);
        console.log(`✅ سُجّل ${commands.length} أمر`);
    } catch (e) {
        console.error('❌ خطأ في التسجيل:', e);
    }
});

// ─── معالج الرسائل (أوامر prefix) ────────────────────────────────
client.on('messageCreate', async msg => {
    if (msg.author.bot) return;

    // !نقاط @يوزر العدد — للأدمن فقط
    if (msg.content.startsWith('!نقاط')) {
        if (!canAddPoints(msg.author)) {
            return msg.reply('❌ هذا الأمر للأدمن فقط');
        }
        const args = msg.content.trim().split(/\s+/);
        // !نقاط <@id> <amount>
        const mentioned = msg.mentions.users.first();
        const amount    = parseInt(args[2] ?? args[1]);

        if (!mentioned || isNaN(amount) || amount <= 0) {
            return msg.reply('❌ الاستخدام الصحيح: `!نقاط @مستخدم عدد_النقاط`\nمثال: `!نقاط @أحمد 50`');
        }

        const newTotal = addUserPoints(mentioned.id, amount);
        const embed = new EmbedBuilder()
            .setTitle('✅ تم إضافة النقاط')
            .setColor(0x57F287)
            .addFields(
                { name: 'المستخدم', value: `<@${mentioned.id}>`, inline: true },
                { name: 'النقاط المضافة', value: `+${amount}`, inline: true },
                { name: 'الرصيد الكلي', value: `${newTotal} نقطة`, inline: true }
            )
            .setTimestamp();
        await msg.reply({ embeds: [embed] });

        // إشعار للمستخدم بالخاص
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('🎉 تم إضافة نقاط لحسابك!')
                .setColor(0x57F287)
                .setDescription(`تم إضافة **${amount} نقطة** لرصيدك\nرصيدك الكلي الآن: **${newTotal} نقطة**`)
                .setTimestamp();
            await mentioned.send({ embeds: [dmEmbed] });
        } catch { /* الخاص مغلق */ }
        return;
    }

    // !رصيد
    if (msg.content.startsWith('!رصيد')) {
        const pts = getUserPoints(msg.author.id);
        const embed = new EmbedBuilder()
            .setTitle('💰 رصيد النقاط')
            .setColor(0x5865F2)
            .setDescription(`رصيدك: **${pts} نقطة**`)
            .setTimestamp();
        return msg.reply({ embeds: [embed] });
    }
});

// ─── معالج Slash Commands ─────────────────────────────────────────
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const isAdmin = interaction.user.id === ADMIN_ID;
    const { commandName } = interaction;

    // /setup
    if (commandName === 'setup') {
        if (!isAdmin) return interaction.reply({ content: '❌ للأدمن فقط', ephemeral: true });
        const { embed, rows } = buildPanel();
        await interaction.channel.send({ embeds: [embed], components: rows });
        return interaction.reply({ content: '✅ تم إرسال البانل', ephemeral: true });
    }

    // /stock
    if (commandName === 'stock') {
        const stock  = getStock();
        const prices = getPrices();
        const types  = Object.keys(prices);
        const embed  = new EmbedBuilder().setTitle('📦 المخزون').setColor(0x2ECC71).setTimestamp();

        if (types.length === 0) {
            embed.setDescription('لا توجد أنواع مضافة بعد');
        } else {
            types.forEach(t => {
                const qty = stock[t]?.length ?? 0;
                embed.addFields({ name: t, value: `${qty}/10 حساب | ${prices[t]}🪙`, inline: true });
            });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /add
    if (commandName === 'add') {
        if (!isAdmin) return interaction.reply({ content: '❌ للأدمن فقط', ephemeral: true });
        const type    = interaction.options.getString('نوع').toLowerCase().trim();
        const account = interaction.options.getString('حساب').trim();
        const prices  = getPrices();

        if (!prices[type]) {
            return interaction.reply({ content: `❌ النوع **${type}** غير موجود. أضفه أولاً بأمر \`/addtype\``, ephemeral: true });
        }

        const stock = getStock();
        if (!stock[type]) stock[type] = [];
        if (stock[type].length >= 10) {
            return interaction.reply({ content: `❌ المخزون ممتلئ! الحد الأقصى 10 حسابات لكل نوع`, ephemeral: true });
        }

        stock[type].push(account);
        saveStock(stock);
        return interaction.reply({ content: `✅ تم إضافة حساب لـ **${type}** (${stock[type].length}/10)`, ephemeral: true });
    }

    // /addtype
    if (commandName === 'addtype') {
        if (!isAdmin) return interaction.reply({ content: '❌ للأدمن فقط', ephemeral: true });
        const type  = interaction.options.getString('نوع').trim();
        const price = interaction.options.getInteger('سعر');
        const prices = getPrices();
        const stock  = getStock();
        const typeKey = type.toLowerCase();

        prices[typeKey] = price;
        if (!stock[typeKey]) stock[typeKey] = [];
        savePrices(prices);
        saveStock(stock);

        return interaction.reply({ content: `✅ تم إضافة نوع **${type}** بسعر **${price} نقطة**`, ephemeral: true });
    }

    // /removetype
    if (commandName === 'removetype') {
        if (!isAdmin) return interaction.reply({ content: '❌ للأدمن فقط', ephemeral: true });
        const type    = interaction.options.getString('نوع').toLowerCase().trim();
        const prices  = getPrices();
        const stock   = getStock();

        if (!prices[type]) return interaction.reply({ content: `❌ النوع **${type}** غير موجود`, ephemeral: true });
        delete prices[type];
        delete stock[type];
        savePrices(prices);
        saveStock(stock);
        return interaction.reply({ content: `✅ تم حذف النوع **${type}**`, ephemeral: true });
    }

    // /points
    if (commandName === 'points') {
        const target = interaction.options.getUser('مستخدم') ?? interaction.user;
        const pts    = getUserPoints(target.id);
        const embed  = new EmbedBuilder()
            .setTitle('💰 رصيد النقاط')
            .setColor(0x5865F2)
            .setDescription(`${target.id === interaction.user.id ? 'رصيدك' : `رصيد ${target.username}`}: **${pts} نقطة**`)
            .setTimestamp();
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // /removeaccount
    if (commandName === 'removeaccount') {
        if (!isAdmin) return interaction.reply({ content: '❌ للأدمن فقط', ephemeral: true });
        const type  = interaction.options.getString('نوع').toLowerCase().trim();
        const index = interaction.options.getInteger('رقم') - 1;
        const stock = getStock();

        if (!stock[type] || stock[type].length === 0)
            return interaction.reply({ content: `❌ لا توجد حسابات في **${type}**`, ephemeral: true });
        if (index < 0 || index >= stock[type].length)
            return interaction.reply({ content: `❌ الرقم غير صحيح`, ephemeral: true });

        const removed = stock[type].splice(index, 1)[0];
        saveStock(stock);
        return interaction.reply({ content: `✅ تم حذف الحساب: \`${removed}\``, ephemeral: true });
    }
});

// ─── معالج الأزرار (شراء الحسابات) ──────────────────────────────
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('buy_')) return;

    const typeKey = interaction.customId.replace('buy_', '');
    await interaction.deferReply({ ephemeral: true });

    const prices = getPrices();
    const stock  = getStock();
    const price  = prices[typeKey];

    if (price === undefined) {
        return interaction.followUp({ content: '❌ هذا النوع لم يعد متاحاً', ephemeral: true });
    }

    if (!stock[typeKey] || stock[typeKey].length === 0) {
        return interaction.followUp({ content: '❌ المخزون فارغ لهذا النوع، ترقب الإعادة!', ephemeral: true });
    }

    const userPts = getUserPoints(interaction.user.id);
    if (userPts < price) {
        return interaction.followUp({
            content: `❌ نقاطك غير كافية!\nرصيدك: **${userPts}** نقطة\nالمطلوب: **${price}** نقطة\n\n> افتح تكت لشراء نقاط`,
            ephemeral: true
        });
    }

    // خصم النقاط وإعطاء الحساب
    const account = stock[typeKey].shift();
    saveStock(stock);
    const ok = deductUserPoints(interaction.user.id, price);

    if (!ok) {
        // في حالة race condition — أعد الحساب
        stock[typeKey].unshift(account);
        saveStock(stock);
        return interaction.followUp({ content: '❌ حدث خطأ في الرصيد، حاول مرة ثانية', ephemeral: true });
    }

    const remaining = getUserPoints(interaction.user.id);

    // إرسال الحساب بالخاص
    const dmEmbed = new EmbedBuilder()
        .setTitle('✅ تم الشراء بنجاح!')
        .setColor(0x57F287)
        .addFields(
            { name: '📦 النوع', value: `\`${typeKey.toUpperCase()}\``, inline: true },
            { name: '💰 النقاط المخصومة', value: `${price} نقطة`, inline: true },
            { name: '💳 رصيدك المتبقي', value: `${remaining} نقطة`, inline: true },
            { name: '🔑 الحساب', value: `\`\`\`\n${account}\n\`\`\`` }
        )
        .setFooter({ text: 'Crown Market • شكراً لشرائك' })
        .setTimestamp();

    try {
        await interaction.user.send({ embeds: [dmEmbed] });
        await interaction.followUp({ content: `✅ تم! الحساب أُرسل لك بالخاص 📥\nرصيدك المتبقي: **${remaining} نقطة**`, ephemeral: true });
    } catch {
        // الخاص مغلق — أعد الحساب والنقاط
        stock[typeKey].unshift(account);
        saveStock(stock);
        addUserPoints(interaction.user.id, price);
        await interaction.followUp({ content: '⚠️ خاصك مغلق! فعّل الرسائل الخاصة من إعدادات الديسكورد ثم حاول مرة ثانية', ephemeral: true });
    }
});

client.login(TOKEN);
