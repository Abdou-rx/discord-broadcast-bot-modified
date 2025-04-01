const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
require('dotenv').config();
const express = require("express");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Your app is listening on port ${PORT}`));
app.get('/', (req, res) => res.send('<body><center><h1>Bot 24H Online!</h1></center></body>'));

let broadcastStatus = {
    active: false,
    total: 0,
    success: 0,
    failed: 0,
    progressMessage: null
};

client.on('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));

client.on("messageCreate", async message => {
    if (message.content.startsWith("!bc") && !broadcastStatus.active) {
        if (!message.member.permissions.has("Administrator")) {
            return message.reply("❌ You need administrator permissions to use this command.");
        }

        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setTitle("❌ Error")
                        .setDescription("Please provide a message!\nUsage: `!bc <message>`")
                        .setColor(0xFF0000)
                ]
            });
        }

        const broadcastMessage = args.slice(1).join(' ');
        broadcastStatus.active = true;
        const startTime = Date.now();

        try {
            const progressEmbed = new EmbedBuilder()
                .setTitle("📢 Broadcast in Progress")
                .setDescription("⏳ Preparing to send messages...")
                .setColor(0xFFFF00);
            
            broadcastStatus.progressMessage = await message.channel.send({ 
                embeds: [progressEmbed] 
            });

            const members = await message.guild.members.fetch();
            broadcastStatus.total = members.size;
            broadcastStatus.success = 0;
            broadcastStatus.failed = 0;

            let nonBotMembers = members.filter(m => !m.user.bot);
            let memberCount = nonBotMembers.size;
            let processed = 0;

            const updateInterval = setInterval(() => {
                updateProgress(message, memberCount);
            }, 1000);

            for (const member of nonBotMembers.values()) {
                try {
                    await member.send({
                        content: `${broadcastMessage}\n- Sent from ${message.guild.name}`
                    });
                    broadcastStatus.success++;
                } catch (error) {
                    broadcastStatus.failed++;
                    console.log(`❌ Failed to send to ${member.user.tag}`);
                }
                
                processed++;
                if (processed % 5 === 0) {
                    updateProgress(message, memberCount);
                }
                
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            clearInterval(updateInterval);
            await updateProgress(message, memberCount, true);


            const endTime = Date.now();
            const executionTime = ((endTime - startTime) / 1000).toFixed(2);
            
            const finalEmbed = new EmbedBuilder()
                .setTitle("✅ Broadcast Complete")
                .setDescription(
                    `**Total Members:** ${memberCount}\n` +
                    `✅ Success: ${broadcastStatus.success}\n` +
                    `❌ Failed: ${broadcastStatus.failed}\n` +
                    `⏱️ Execution Time: ${executionTime} seconds`
                )
                .setColor(0x00FF00);
            
            await broadcastStatus.progressMessage.edit({ embeds: [finalEmbed] });

        } catch (error) {
            console.error("Broadcast error:", error);
            await message.channel.send("❌ An error occurred while broadcasting.");
        } finally {
            broadcastStatus.active = false;
        }
    }
});

async function updateProgress(message, total, isFinal = false) {
    if (!broadcastStatus.progressMessage) return;

    const progress = Math.min(broadcastStatus.success + broadcastStatus.failed, total);
    const percentage = Math.round((progress / total) * 100);
    const progressBar = createProgressBar(percentage, 20);
    
    const embed = new EmbedBuilder()
        .setTitle(isFinal ? "✅ Broadcast Complete" : "📢 Broadcast in Progress")
        .setDescription(
            `**Progress:** ${progress}/${total} members\n` +
            `\`${progressBar}\` ${percentage}%\n\n` +
            `✅ Success: ${broadcastStatus.success}\n` +
            `❌ Failed: ${broadcastStatus.failed}`
        )
        .setColor(isFinal ? 0x00FF00 : 0xFFFF00);

    try {
        await broadcastStatus.progressMessage.edit({ embeds: [embed] });
    } catch (error) {
        console.error("Failed to update progress:", error);
    }
}

function createProgressBar(percentage, length) {
    const progress = Math.round((percentage / 100) * length);
    return '█'.repeat(progress) + '░'.repeat(length - progress);
}

client.login(process.env.TOKEN).catch(error => {
    console.error("Login failed:", error);
    process.exit(1);
});