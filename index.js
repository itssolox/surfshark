const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

// Bot configuration
const token = '7907410427:AAFeY5uMx7kUJW9csR9ts17blBfmMIizoKU';
const bot = new Telegraf(token);
const channelId = -1002697504696;
const channelUsername = 'https://t.me/+Jj-2MqY4DbUzZGZl';
const ownerId = 6994528708;

// Database file
const DB_FILE = 'users.json';

// Initialize database if it doesn't exist
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({}));
}

// Helper functions
function loadUsers() {
  try {
    const data = fs.readFileSync(DB_FILE);
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading users:', error);
    return {};
  }
}

function saveUsers(users) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

function getUser(userId) {
  const users = loadUsers();
  if (!users[userId]) {
    users[userId] = {
      id: userId,
      referredBy: null,
      referrals: [],
      points: 0,
      joinedChannel: false
    };
    saveUsers(users);
  }
  
  // Ensure referrals is always an array
  if (!users[userId].referrals) {
    users[userId].referrals = [];
    saveUsers(users);
  }
  
  return users[userId];
}

function updateUser(userId, updates) {
  const users = loadUsers();
  users[userId] = { ...users[userId], ...updates };
  saveUsers(users);
  return users[userId];
}

async function checkMembership(ctx) {
  try {
    const userId = ctx.from.id;
    const chatMember = await bot.telegram.getChatMember(channelId, userId);
    
    const isChannelMember = ['creator', 'administrator', 'member'].includes(chatMember.status);
    updateUser(userId, { joinedChannel: isChannelMember });
    
    return isChannelMember;
  } catch (error) {
    console.error('Error checking membership:', error);
    return false;
  }
}

// Main menu keyboard
function getMainKeyboard() {
  return Markup.keyboard([
    ['👥 Refer Friends', '🔢 My Points'],
    ['💰 Withdraw Reward']
  ]).resize();
}

// Bot commands and handlers
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId);
  
  // Check if referral code is provided
  const startPayload = ctx.startPayload;
  if (startPayload && startPayload !== userId.toString()) {
    const referrerId = startPayload;
    const users = loadUsers();
    
    // Only set referral if the user hasn't been referred before
    if (!user.referredBy && users[referrerId]) {
      updateUser(userId, { referredBy: referrerId });
    }
  }
  
  // Welcome message with channel join requirement
  await ctx.replyWithHTML(
    `🎉 <b>Welcome to the Refer & Earn Bot!</b> 🎉\n\n` +
    `To use this bot, you need to join our channel first:\n` +
    `${channelUsername}\n\n` +
    `After joining, click the "✅ Check Membership" button below.`,
    Markup.inlineKeyboard([
      Markup.button.url('📢 Join Channel', channelUsername),
      Markup.button.callback('✅ Check Membership', 'check_membership')
    ])
  );
});

bot.action('check_membership', async (ctx) => {
  const userId = ctx.from.id;
  const isMember = await checkMembership(ctx);
  
  if (isMember) {
    const user = getUser(userId);
    
    // Ensure referrals exists and is an array
    if (!user.referrals) {
      user.referrals = [];
      updateUser(userId, { referrals: [] });
    }
    
    // If user was referred by someone, credit the referrer
    if (user.referredBy) {
      const referrer = getUser(user.referredBy);
      
      // Ensure referrer's referrals exists and is an array
      if (!referrer.referrals) {
        referrer.referrals = [];
      }
      
      // Only add if not already in the list
      if (!referrer.referrals.includes(userId)) {
        referrer.referrals.push(userId);
        referrer.points += 1;
        updateUser(user.referredBy, referrer);
        
        // Notify referrer
        try {
          await bot.telegram.sendMessage(
            user.referredBy,
            `🎁 Congratulations! A user you referred has joined. You now have ${referrer.points} points!`
          );
        } catch (error) {
          console.error('Error notifying referrer:', error);
        }
      }
    }
    
    await ctx.editMessageText(
      `✅ <b>Membership confirmed!</b>\n\n` + 
      `Welcome to our Refer & Earn program! Invite 3 friends to earn a Surfshark VPN login.\n\n` +
      `Use the buttons below to navigate:`,
      {
        parse_mode: 'HTML',
        reply_markup: undefined
      }
    );
    
    await ctx.reply('Choose an option:', getMainKeyboard());
  } else {
    await ctx.answerCbQuery('❌ You need to join the channel first!');
    await ctx.reply(
      `❌ You haven't joined our channel yet!\n\n` +
      `Please join: ${channelUsername}\n\n` +
      `After joining, click "✅ Check Membership" again.`,
      Markup.inlineKeyboard([
        Markup.button.url('📢 Join Channel', channelUsername),
        Markup.button.callback('✅ Check Membership', 'check_membership')
      ])
    );
  }
});

bot.hears('👥 Refer Friends', async (ctx) => {
  const userId = ctx.from.id;
  const isMember = await checkMembership(ctx);
  
  if (!isMember) {
    return ctx.reply(
      `❌ You need to join our channel first!\n\n` +
      `Please join: ${channelUsername}\n\n` +
      `After joining, check your membership.`,
      Markup.inlineKeyboard([
        Markup.button.url('📢 Join Channel', channelUsername),
        Markup.button.callback('✅ Check Membership', 'check_membership')
      ])
    );
  }
  
  const user = getUser(userId);
  const botInfo = await bot.telegram.getMe();
  const referralLink = `https://t.me/${botInfo.username}?start=${userId}`;
  
  // Ensure referrals exists and is an array
  if (!user.referrals) {
    user.referrals = [];
    updateUser(userId, { referrals: [] });
  }
  
  await ctx.replyWithHTML(
    `🔗 <b>Your Referral Link</b> 🔗\n\n` +
    `Share this link with your friends:\n` +
    `<code>${referralLink}</code>\n\n` +
    `Current referrals: ${user.referrals.length}/3\n` +
    `Points earned: ${user.points}\n\n` +
    `<b>How it works:</b>\n` +
    `• Share your referral link with friends\n` +
    `• Friends must join our channel\n` +
    `• You get 1 point per referral\n` +
    `• Earn a Surfshark VPN login after 3 referrals`
  );
});

bot.hears('🔢 My Points', async (ctx) => {
  const userId = ctx.from.id;
  const isMember = await checkMembership(ctx);
  
  if (!isMember) {
    return ctx.reply(
      `❌ You need to join our channel first!\n\n` +
      `Please join: ${channelUsername}\n\n` +
      `After joining, check your membership.`,
      Markup.inlineKeyboard([
        Markup.button.url('📢 Join Channel', channelUsername),
        Markup.button.callback('✅ Check Membership', 'check_membership')
      ])
    );
  }
  
  const user = getUser(userId);
  
  // Ensure referrals exists and is an array
  if (!user.referrals) {
    user.referrals = [];
    updateUser(userId, { referrals: [] });
  }
  
  await ctx.replyWithHTML(
    `📊 <b>Your Stats</b> 📊\n\n` +
    `Points: ${user.points}\n` +
    `Referrals: ${user.referrals.length}\n\n` +
    `${user.points >= 3 ? '✅ You can withdraw your reward!' : `🔄 You need ${3 - user.points} more points to withdraw.`}`
  );
});

bot.hears('💰 Withdraw Reward', async (ctx) => {
  const userId = ctx.from.id;
  const isMember = await checkMembership(ctx);
  
  if (!isMember) {
    return ctx.reply(
      `❌ You need to join our channel first!\n\n` +
      `Please join: ${channelUsername}\n\n` +
      `After joining, check your membership.`,
      Markup.inlineKeyboard([
        Markup.button.url('📢 Join Channel', channelUsername),
        Markup.button.callback('✅ Check Membership', 'check_membership')
      ])
    );
  }
  
  const user = getUser(userId);
  
  if (user.points >= 3) {
    // Reset points after withdrawal
    updateUser(userId, { points: 0 });
    
    await ctx.replyWithHTML(
      `🎉 <b>Congratulations!</b> 🎉\n\n` +
      `You have successfully withdrawn your reward!\n\n` +
      `Please DM:\n` +
      `@its_soloz or @solox_se_baatbot\n\n` +
      `Your points have been reset to 0. You can continue referring friends to earn more rewards!`
    );
  } else {
    await ctx.reply(
      `❌ Not enough points!\n\n` +
      `You currently have ${user.points} points.\n` +
      `You need 3 points to withdraw a Surfshark VPN login.\n\n` +
      `Keep referring friends to earn more points!`
    );
  }
});

// Admin broadcast command
bot.command('broadcast', async (ctx) => {
  const userId = ctx.from.id;
  
  if (userId !== ownerId) {
    return ctx.reply('❌ This command is only available to the bot owner.');
  }
  
  const messageText = ctx.message.text.split(' ').slice(1).join(' ');
  
  if (!messageText) {
    return ctx.reply('Usage: /broadcast [message]');
  }
  
  const users = loadUsers();
  let sentCount = 0;
  let failedCount = 0;
  
  for (const userId in users) {
    try {
      await bot.telegram.sendMessage(userId, messageText, { parse_mode: 'HTML' });
      sentCount++;
    } catch (error) {
      failedCount++;
      console.error(`Failed to send broadcast to ${userId}:`, error);
    }
  }
  
  await ctx.reply(`📢 Broadcast sent!\n✅ Successful: ${sentCount}\n❌ Failed: ${failedCount}`);
});

// Add data recovery middleware
bot.use(async (ctx, next) => {
  try {
    // Make sure user data is properly initialized before proceeding
    if (ctx.from && ctx.from.id) {
      const user = getUser(ctx.from.id);
      
      // Ensure critical properties exist
      if (!user.referrals) {
        updateUser(ctx.from.id, { referrals: [] });
      }
      
      if (user.points === undefined || user.points === null) {
        updateUser(ctx.from.id, { points: 0 });
      }
    }
    
    return next();
  } catch (error) {
    console.error('Error in data recovery middleware:', error);
    return next();
  }
});

// Middleware to handle all messages
bot.on('message', async (ctx, next) => {
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    const userId = ctx.from.id;
    const isMember = await checkMembership(ctx);
    
    if (!isMember) {
      return ctx.reply(
        `❌ You need to join our channel first!\n\n` +
        `Please join: ${channelUsername}\n\n` +
        `After joining, check your membership.`,
        Markup.inlineKeyboard([
          Markup.button.url('📢 Join Channel', channelUsername),
          Markup.button.callback('✅ Check Membership', 'check_membership')
        ])
      );
    }
  }
  
  return next();
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  
  // Try to recover and notify the user that something went wrong
  try {
    if (ctx && ctx.reply) {
      ctx.reply('Sorry, something went wrong. Please try again later.').catch(e => {
        console.error('Failed to send error message to user:', e);
      });
    }
  } catch (replyError) {
    console.error('Failed to handle error properly:', replyError);
  }
});

// Start bot
bot.launch().then(() => {
  console.log('Bot started successfully!');
}).catch(err => {
  console.error('Failed to start bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
