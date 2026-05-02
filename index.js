const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const app = express();
app.get('/', (req, res) => res.send('TSA Sistemi 7/24 Aktif!'));
app.listen(8080);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Komut koleksiyonunu oluşturuyoruz
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const slashCommands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommands.push(command.data.toJSON());
    }
}

// Bot hazır olduğunda komutları Discord'a kaydet
client.once('ready', async () => {
    console.log(`${client.user.tag} girişi yapıldı!`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('Slash komutları başarıyla yüklendi.');
    } catch (error) {
        console.error(error);
    }
});

// Komut kullanımı ve Ticket etkileşimi
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'Komut çalışırken bir hata oluştu!', ephemeral: true });
        }
    }

    // Ticket Seçim Menüsü İşleyici
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const { ticketHandler } = require('./commands/destek-kur.js');
        await ticketHandler(interaction);
    }
});

client.login(process.env.TOKEN);
