const fs = require('fs');
const path = require('path');

async function main() {
  const { createAvatar } = require('@dicebear/core');
  const { avataaars } = require('@dicebear/collection');
  const sharp = require('sharp');

  const baseDir = path.join(__dirname, '../assets/avatars');
  const categories = ['male', 'female', 'chef', 'waiter', 'manager', 'cashier', 'bartender'];

  // Create directories
  categories.forEach(cat => {
    fs.mkdirSync(path.join(baseDir, cat), { recursive: true });
  });

  console.log('Generating 500 unique avatars with correct features, hair, clothes, and smiles...');

  // Correct values from Avataaars schema
  const hairColors = ["2c1b18", "4a312c", "a55728", "b58143", "724133", "ecdcbf", "c93305"];
  const skinColors = ["614335", "d08b5b", "ae5d29", "edb98a", "ffdbb4", "f8d25c"];
  
  // Pastel backgrounds to match the design sheet
  const backgroundColors = ["b1e2ff", "ffafb9", "e0e7ff", "a7ffc4", "fef3c7", "ccfbf1", "fce7f3", "dbeafe"];

  const config = {
    male: {
      count: 100,
      prefix: 'male',
      options: (i) => ({
        top: [['shortWaved', 'shortFlat', 'shortRound', 'theCaesar', 'theCaesarAndSidePart', 'shavedSides', 'dreads01'][i % 7]],
        accessories: i % 4 === 0 ? [['prescription01', 'prescription02', 'round', 'sunglasses'][i % 4]] : [],
        facialHair: i % 3 === 0 ? [['beardLight', 'beardMajestic', 'beardMedium', 'moustacheFancy', 'moustacheMagnum'][i % 5]] : [],
        clothing: [['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'graphicShirt', 'hoodie', 'shirtCrewNeck', 'shirtVNeck'][i % 7]],
        mouth: ['smile'],
        eyes: [['default', 'happy', 'wink'][i % 3]],
        eyebrows: [['default', 'defaultNatural', 'flatNatural'][i % 3]],
      })
    },
    female: {
      count: 100,
      prefix: 'female',
      options: (i) => ({
        top: [['longButNotTooLong', 'bob', 'bun', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'froBand', 'miaWallace', 'straight01', 'straight02'][i % 12]],
        accessories: i % 5 === 0 ? [['prescription01', 'prescription02', 'round', 'sunglasses'][i % 4]] : [],
        facialHair: [],
        clothing: [['blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'graphicShirt', 'hoodie', 'shirtScoopNeck', 'shirtVNeck'][i % 7]],
        mouth: ['smile'],
        eyes: [['default', 'happy', 'wink'][i % 3]],
        eyebrows: [['default', 'defaultNatural', 'flatNatural'][i % 3]],
      })
    },
    chef: {
      count: 50,
      prefix: 'chef',
      options: (i) => {
        // Diverse kitchen-friendly hairstyles (short hair for men, buns/bob for women, no floppy sun hats)
        const chefHairs = ['shortFlat', 'shortRound', 'sides', 'theCaesar', 'bob', 'bun', 'shavedSides'];
        const chosenHair = chefHairs[i % chefHairs.length];
        return {
          top: [chosenHair],
          accessories: [],
          clothing: [['overall']], // apron look
          clothesColor: [['ffffff']], // white chef coat
          mouth: ['smile'],
          eyes: [['default', 'happy'][i % 2]],
          eyebrows: [['default', 'defaultNatural'][i % 2]],
        };
      }
    },
    waiter: {
      count: 50,
      prefix: 'waiter',
      options: (i) => ({
        top: [['shortWaved', 'bob', 'bun'][i % 3]],
        accessories: [],
        clothing: [['shirtVNeck', 'collarAndSweater'][i % 2]],
        clothesColor: [['262e33', '3c4f5c'][i % 2]],
        mouth: ['smile'],
        eyes: [['default', 'happy'][i % 2]],
        eyebrows: [['default', 'defaultNatural'][i % 2]],
      })
    },
    manager: {
      count: 50,
      prefix: 'manager',
      options: (i) => ({
        top: [['shortFlat', 'straight02', 'bun'][i % 3]],
        accessories: i % 3 === 0 ? [['prescription01', 'prescription02'][i % 2]] : [],
        clothing: [['blazerAndShirt', 'blazerAndSweater'][i % 2]],
        clothesColor: [['25557c', '3c4f5c'][i % 2]],
        mouth: ['smile'],
        eyes: [['default', 'happy'][i % 2]],
        eyebrows: [['default', 'defaultNatural'][i % 2]],
      })
    },
    cashier: {
      count: 50,
      prefix: 'cashier',
      options: (i) => ({
        top: [['theCaesar', 'bob', 'curly'][i % 3]],
        accessories: [['prescription02', 'prescription01'][i % 2]],
        clothing: [['graphicShirt', 'hoodie'][i % 2]],
        clothesColor: [['ff5c5c', '65c9ff'][i % 2]],
        mouth: ['smile'],
        eyes: [['default', 'happy'][i % 2]],
        eyebrows: [['default', 'defaultNatural'][i % 2]],
      })
    },
    bartender: {
      count: 50,
      prefix: 'bartender',
      options: (i) => ({
        top: [['shaggy', 'longButNotTooLong', 'dreads'][i % 3]],
        facialHair: [['beardMedium', 'moustacheFancy'][i % 2]],
        clothing: [['shirtVNeck', 'graphicShirt'][i % 2]],
        clothesColor: [['262e33', '3c4f5c'][i % 2]],
        mouth: ['smile'],
        eyes: [['default', 'happy'][i % 2]],
        eyebrows: [['default', 'defaultNatural'][i % 2]],
      })
    }
  };

  let totalGenerated = 0;

  for (const cat of categories) {
    const catConfig = config[cat];
    for (let i = 1; i <= catConfig.count; i++) {
      const idxStr = String(i).padStart(3, '0');
      const seed = `${cat}_avatar_seed_${i}_${Math.random()}`;
      
      const hairColor = hairColors[i % hairColors.length];
      const skinColor = skinColors[i % skinColors.length];
      
      const customOptions = catConfig.options(i);
      const avatarOpts = {
        seed,
        hairColor: [hairColor],
        skinColor: [skinColor],
        backgroundColor: [backgroundColors[i % backgroundColors.length]], // Circular pastel backdrop
        ...customOptions
      };

      const avatar = createAvatar(avataaars, avatarOpts);
      const svg = avatar.toString();

      const fileName = `${catConfig.prefix}_${idxStr}.png`;
      const filePath = path.join(baseDir, cat, fileName);

      // Convert SVG to 512x512 PNG with sharp
      await sharp(Buffer.from(svg))
        .resize(512, 512)
        .png()
        .toFile(filePath);

      totalGenerated++;
      if (totalGenerated % 50 === 0) {
        console.log(`Generated ${totalGenerated}/500 avatars...`);
      }
    }
  }

  // Create default.png (using a general manager avatar as the default)
  const defaultAvatar = createAvatar(avataaars, {
    seed: 'default_avatar',
    clothing: ['blazerAndShirt'],
    mouth: ['smile'],
    backgroundColor: ['b1e2ff']
  });
  await sharp(Buffer.from(defaultAvatar.toString()))
    .resize(512, 512)
    .png()
    .toFile(path.join(baseDir, 'default.png'));

  console.log('Successfully generated all 500 avatars + default.png!');
}

main().catch(err => {
  console.error('Error generating avatars:', err);
  process.exit(1);
});
