/*
 * hallucination-hunt / content.js
 * 《幻觉狩猎》静态事实库：每条 fact 含中英双语 claims 模板，
 * 供游戏生成 ENTITY_SWAP（同类实体替换）与 NUMBER_DRIFT（数值漂移）两类幻觉。
 * 全部为长期稳定、可公开查证的常识性事实；零依赖、零外部请求。
 * 仅使用 IIFE + window 命名空间，可直接以 file:// 打开。
 */
(function (global) {
  'use strict';

  var CATEGORIES = [
    'geography',
    'science',
    'space',
    'history',
    'technology',
    'animals',
    'language',
    'general'
  ];

  var facts = [
    {
      id: 'geo-ca-capital',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Ottawa',
      checked: '2026-10-01',
      zh: {
        topic: '加拿大',
        claims: [
          { t: '{subject}的首都是{value}。', s: { subject: '加拿大', value: '渥太华' }, alt: ['多伦多', '温哥华', '蒙特利尔'] },
          { t: '{subject}位于北美洲北部。', s: { subject: '加拿大' } },
          { t: '{subject}的陆地面积约为 {n} 万平方公里。', s: { subject: '加拿大', n: '998' }, num: { min: 100, max: 2000 } }
        ],
        explanation: '渥太华是加拿大的首都，位于安大略省东部，与魁北克省隔渥太华河相望。'
      },
      en: {
        topic: 'Canada',
        claims: [
          { t: 'The capital of {subject} is {value}.', s: { subject: 'Canada', value: 'Ottawa' }, alt: ['Toronto', 'Vancouver', 'Montreal'] },
          { t: '{subject} is located in the northern part of North America.', s: { subject: 'Canada' } },
          { t: '{subject} covers about {n} million square kilometres.', s: { subject: 'Canada', n: '9.98' }, num: { min: 1, max: 20 } }
        ],
        explanation: 'Ottawa is the capital of Canada; it lies in eastern Ontario on the Ottawa River.'
      }
    },
    {
      id: 'sci-water-formula',
      category: 'science',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/water',
      checked: '2026-10-01',
      zh: {
        topic: '水',
        claims: [
          { t: '{subject}的化学式是{value}。', s: { subject: '水', value: 'H₂O' }, alt: ['CO₂', 'NaCl', 'O₂'] },
          { t: '{subject}由氢元素和氧元素组成。', s: { subject: '水' } },
          { t: '{subject}在标准大气压下的沸点约为 {n} 摄氏度。', s: { subject: '水', n: '100' }, num: { min: -100, max: 500 } }
        ],
        explanation: '一个水分子由两个氢原子和一个氧原子组成，在标准大气压下100摄氏度沸腾。'
      },
      en: {
        topic: 'Water',
        claims: [
          { t: 'The chemical formula of {subject} is {value}.', s: { subject: 'water', value: 'H₂O' }, alt: ['CO₂', 'NaCl', 'O₂'] },
          { t: '{subject} is composed of hydrogen and oxygen.', s: { subject: 'Water' } },
          { t: '{subject} boils at about {n} degrees Celsius at standard atmospheric pressure.', s: { subject: 'Water', n: '100' }, num: { min: -100, max: 500 } }
        ],
        explanation: 'A water molecule consists of two hydrogen atoms and one oxygen atom; it boils at 100 °C at standard pressure.'
      }
    },
    {
      id: 'space-mars-moons',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/mars/',
      checked: '2026-10-01',
      zh: {
        topic: '火星',
        claims: [
          { t: '{subject}是太阳系中距离太阳第四近的行星。', s: { subject: '火星' } },
          { t: '{subject}拥有 {n} 颗天然卫星。', s: { subject: '火星', n: '2' }, num: { min: 0, max: 20 } },
          { t: '{subject}的英文名源自罗马神话中的{value}之神。', s: { subject: '火星', value: '战争' }, alt: ['海洋', '农业', '爱'] }
        ],
        explanation: '火星有两颗小卫星——火卫一和火卫二，其名字来自罗马神话中的战神玛尔斯。'
      },
      en: {
        topic: 'Mars',
        claims: [
          { t: '{subject} is the fourth planet from the Sun in the Solar System.', s: { subject: 'Mars' } },
          { t: '{subject} has {n} natural moons.', s: { subject: 'Mars', n: '2' }, num: { min: 0, max: 20 } },
          { t: 'The English name of {subject} comes from the Roman god of {value}.', s: { subject: 'Mars', value: 'war' }, alt: ['the sea', 'agriculture', 'love'] }
        ],
        explanation: 'Mars has two small moons, Phobos and Deimos, and is named after the Roman god of war.'
      }
    },
    {
      id: 'hist-bastille-1789',
      category: 'history',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/event/French-Revolution',
      checked: '2026-10-01',
      zh: {
        topic: '法国大革命',
        claims: [
          { t: '{subject}始于{value}攻占巴士底狱。', s: { subject: '法国大革命', value: '1789年' }, alt: ['1776年', '1815年', '1848年'] },
          { t: '{subject}推翻了法国的君主专制制度。', s: { subject: '法国大革命' } },
          { t: '攻占巴士底狱的事件发生在{value}的巴黎。', s: { value: '1789年7月14日' } }
        ],
        explanation: '1789年7月14日巴黎民众攻占巴士底狱，通常被视为法国大革命的开端。'
      },
      en: {
        topic: 'The French Revolution',
        claims: [
          { t: '{subject} began with the storming of the Bastille in {value}.', s: { subject: 'The French Revolution', value: '1789' }, alt: ['1776', '1815', '1848'] },
          { t: '{subject} brought an end to absolute monarchy in France.', s: { subject: 'The French Revolution' } },
          { t: 'The Bastille was stormed in Paris on {value}.', s: { value: '14 July 1789' } }
        ],
        explanation: 'On 14 July 1789 Parisians stormed the Bastille, an event widely seen as the start of the French Revolution.'
      }
    },
    {
      id: 'tech-http-default-port',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'IETF RFC 9110',
      sourceUrl: 'https://www.rfc-editor.org/rfc/rfc9110.html',
      checked: '2026-10-01',
      zh: {
        topic: 'HTTP',
        claims: [
          { t: '{subject}的默认端口号是 {value}。', s: { subject: 'HTTP', value: '80' }, alt: ['443', '8080', '21'] },
          { t: '{subject}是一种应用层协议。', s: { subject: 'HTTP' } },
          { t: '{subject}是万维网上传输超文本的基础协议。', s: { subject: 'HTTP' } }
        ],
        explanation: 'HTTP 是万维网的数据通信基础，默认使用 80 端口；HTTPS 默认使用 443 端口。'
      },
      en: {
        topic: 'HTTP',
        claims: [
          { t: 'The default port number of {subject} is {value}.', s: { subject: 'HTTP', value: '80' }, alt: ['443', '8080', '21'] },
          { t: '{subject} is an application-layer protocol.', s: { subject: 'HTTP' } },
          { t: '{subject} is the foundation protocol for transferring hypertext on the World Wide Web.', s: { subject: 'HTTP' } }
        ],
        explanation: 'HTTP is the foundation of data communication on the Web and uses port 80 by default; HTTPS uses 443.'
      }
    },
    {
      id: 'animal-blue-whale-size',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'NOAA Fisheries',
      sourceUrl: 'https://www.fisheries.noaa.gov/species/blue-whale',
      checked: '2026-10-01',
      zh: {
        topic: '蓝鲸',
        claims: [
          { t: '{subject}是目前已知体型最大的动物。', s: { subject: '蓝鲸' } },
          { t: '{subject}属于{value}动物。', s: { subject: '蓝鲸', value: '哺乳' }, alt: ['爬行', '两栖', '鱼'] },
          { t: '{subject}的成年体长可达约 {n} 米。', s: { subject: '蓝鲸', n: '30' }, num: { min: 5, max: 60 } }
        ],
        explanation: '蓝鲸是现存体型最大的动物，也是已知地球生命史上最大的动物，属于哺乳动物。'
      },
      en: {
        topic: 'The blue whale',
        claims: [
          { t: '{subject} is the largest animal known to have ever lived.', s: { subject: 'The blue whale' } },
          { t: '{subject} is a {value}.', s: { subject: 'The blue whale', value: 'mammal' }, alt: ['reptile', 'amphibian', 'fish'] },
          { t: '{subject} can grow to about {n} metres in length.', s: { subject: 'The blue whale', n: '30' }, num: { min: 5, max: 60 } }
        ],
        explanation: 'The blue whale is the largest animal known to have ever lived, and it is a mammal.'
      }
    },
    {
      id: 'lang-chinese-sinitic',
      category: 'language',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Chinese-languages',
      checked: '2026-10-01',
      zh: {
        topic: '汉语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '汉语', value: '汉藏' }, alt: ['印欧', '阿尔泰', '南岛'] },
          { t: '{subject}使用汉字书写。', s: { subject: '汉语' } },
          { t: '{subject}是世界上使用人数最多的语言之一。', s: { subject: '汉语' } }
        ],
        explanation: '汉语属汉藏语系，以汉字书写，是世界上使用人数最多的语言之一。'
      },
      en: {
        topic: 'Chinese',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Chinese', value: 'Sino-Tibetan' }, alt: ['Indo-European', 'Altaic', 'Austronesian'] },
          { t: '{subject} is written with Chinese characters.', s: { subject: 'Chinese' } },
          { t: '{subject} is one of the most widely spoken languages in the world.', s: { subject: 'Chinese' } }
        ],
        explanation: 'Chinese belongs to the Sino-Tibetan family, is written with Chinese characters, and is one of the most widely spoken languages in the world.'
      }
    },
    {
      id: 'gen-metre-si-base',
      category: 'general',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'BIPM',
      sourceUrl: 'https://www.bipm.org/en/measurement-units',
      checked: '2026-10-01',
      zh: {
        topic: '米',
        claims: [
          { t: '{subject}是国际单位制中长度的基本单位。', s: { subject: '米' } },
          { t: '{subject}的符号是 {value}。', s: { subject: '米', value: 'm' }, alt: ['M', 'mt', 'l'] },
          { t: '{subject}的定义自1983年起基于真空中的光速。', s: { subject: '米' } }
        ],
        explanation: '米是国际单位制的长度基本单位，符号为 m，其定义基于真空中的光速这一物理常量。'
      },
      en: {
        topic: 'The metre',
        claims: [
          { t: '{subject} is the base unit of length in the International System of Units.', s: { subject: 'The metre' } },
          { t: 'The symbol of {subject} is {value}.', s: { subject: 'the metre', value: 'm' }, alt: ['M', 'mt', 'l'] },
          { t: 'Since 1983 the definition of {subject} has been based on the speed of light in vacuum.', s: { subject: 'the metre' } }
        ],
        explanation: 'The metre is the SI base unit of length, written m, and its definition is based on the speed of light in vacuum.'
      }
    },
    {
      id: 'geo-nile-mouth',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Nile-River',
      checked: '2026-10-01',
      zh: {
        topic: '尼罗河',
        claims: [
          { t: '{subject}最终注入{value}。', s: { subject: '尼罗河', value: '地中海' }, alt: ['红海', '黑海', '波罗的海'] },
          { t: '{subject}自南向北流经埃及。', s: { subject: '尼罗河' } },
          { t: '{subject}全长约 {n} 公里。', s: { subject: '尼罗河', n: '6650' }, num: { min: 1000, max: 10000 } }
        ],
        explanation: '尼罗河自非洲内陆向北流经埃及，最终在三角洲注入地中海。'
      },
      en: {
        topic: 'The Nile',
        claims: [
          { t: '{subject} flows into the {value}.', s: { subject: 'The Nile', value: 'Mediterranean Sea' }, alt: ['Red Sea', 'Black Sea', 'Baltic Sea'] },
          { t: '{subject} flows northward through Egypt.', s: { subject: 'The Nile' } },
          { t: '{subject} is about {n} kilometres long.', s: { subject: 'The Nile', n: '6650' }, num: { min: 1000, max: 10000 } }
        ],
        explanation: 'The Nile flows north through Egypt and empties into the Mediterranean Sea through its delta.'
      }
    },
    {
      id: 'sci-light-speed-vacuum',
      category: 'science',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NIST CODATA',
      sourceUrl: 'https://physics.nist.gov/cgi-bin/cuu/Value?c',
      checked: '2026-10-01',
      zh: {
        topic: '光',
        claims: [
          { t: '{subject}在真空中的传播速度约为每秒 {n} 公里。', s: { subject: '光', n: '299792' }, num: { min: 1000, max: 1000000 } },
          { t: '{subject}在真空中的速度是一个物理常量。', s: { subject: '光' } },
          { t: '{subject}在真空中的速度通常用符号 {value} 表示。', s: { subject: '光', value: 'c' }, alt: ['g', 'k', 'h'] }
        ],
        explanation: '真空中的光速约为每秒 299792 公里，是物理学中最重要的常量之一，符号为 c。'
      },
      en: {
        topic: 'Light',
        claims: [
          { t: '{subject} travels at about {n} kilometres per second in a vacuum.', s: { subject: 'Light', n: '299792' }, num: { min: 1000, max: 1000000 } },
          { t: 'The speed of {subject} in a vacuum is a physical constant.', s: { subject: 'light' } },
          { t: 'The speed of {subject} in a vacuum is usually denoted by the symbol {value}.', s: { subject: 'light', value: 'c' }, alt: ['g', 'k', 'h'] }
        ],
        explanation: 'Light travels at about 299,792 kilometres per second in a vacuum; this constant is denoted c.'
      }
    },
    {
      id: 'space-jupiter-largest',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/jupiter/',
      checked: '2026-10-01',
      zh: {
        topic: '木星',
        claims: [
          { t: '{subject}是太阳系中体积最大的行星。', s: { subject: '木星' } },
          { t: '{subject}的赤道直径约为 {n} 万公里。', s: { subject: '木星', n: '14' }, num: { min: 1, max: 100 } },
          { t: '{subject}的大红斑是一个持续了数百年的巨大风暴。', s: { subject: '木星' } }
        ],
        explanation: '木星是太阳系中体积和质量最大的行星，其大红斑是一个长期存在的大型反气旋风暴。'
      },
      en: {
        topic: 'Jupiter',
        claims: [
          { t: '{subject} is the largest planet in the Solar System.', s: { subject: 'Jupiter' } },
          { t: 'The equatorial diameter of {subject} is about {n} thousand kilometres.', s: { subject: 'Jupiter', n: '143' }, num: { min: 1, max: 1000 } },
          { t: 'The Great Red Spot of {subject} is a giant storm that has lasted for centuries.', s: { subject: 'Jupiter' } }
        ],
        explanation: 'Jupiter is the largest planet in the Solar System, and its Great Red Spot is a long-lived giant storm.'
      }
    },
    {
      id: 'hist-roman-first-emperor',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Roman-Empire',
      checked: '2026-10-01',
      zh: {
        topic: '罗马帝国',
        claims: [
          { t: '{subject}的第一位皇帝是{value}。', s: { subject: '罗马帝国', value: '奥古斯都' }, alt: ['尤利乌斯·凯撒', '尼禄', '图拉真'] },
          { t: '{subject}的首都位于{value}。', s: { subject: '罗马帝国', value: '罗马' }, alt: ['雅典', '迦太基', '亚历山大'] },
          { t: '西罗马帝国于公元 {n} 年终结。', s: { n: '476' }, num: { min: 1, max: 1000 } }
        ],
        explanation: '奥古斯都是罗马帝国的第一位皇帝；尤利乌斯·凯撒虽掌握大权，但从未称帝。'
      },
      en: {
        topic: 'The Roman Empire',
        claims: [
          { t: 'The first emperor of {subject} was {value}.', s: { subject: 'the Roman Empire', value: 'Augustus' }, alt: ['Julius Caesar', 'Nero', 'Trajan'] },
          { t: 'The capital of {subject} was {value}.', s: { subject: 'the Roman Empire', value: 'Rome' }, alt: ['Athens', 'Carthage', 'Alexandria'] },
          { t: 'The Western Roman Empire came to an end in {n} AD.', s: { n: '476' }, num: { min: 1, max: 1000 } }
        ],
        explanation: 'Augustus was the first Roman emperor; Julius Caesar held great power but was never emperor.'
      }
    },
    {
      id: 'tech-javascript-eich',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/JavaScript',
      checked: '2026-10-01',
      zh: {
        topic: 'JavaScript',
        claims: [
          { t: '{subject}由{value}于1995年创造。', s: { subject: 'JavaScript', value: '布兰登·艾奇' }, alt: ['詹姆斯·高斯林', '吉多·范罗苏姆', '比雅尼·斯特劳斯特鲁普'] },
          { t: '{subject}的标准化名称是 ECMAScript。', s: { subject: 'JavaScript' } },
          { t: '{subject}是一种可以在网页浏览器中运行的脚本语言。', s: { subject: 'JavaScript' } }
        ],
        explanation: 'JavaScript 由布兰登·艾奇于1995年在网景公司创造，其标准化规范名为 ECMAScript。'
      },
      en: {
        topic: 'JavaScript',
        claims: [
          { t: '{subject} was created by {value} in 1995.', s: { subject: 'JavaScript', value: 'Brendan Eich' }, alt: ['James Gosling', 'Guido van Rossum', 'Bjarne Stroustrup'] },
          { t: 'The standardised name of {subject} is ECMAScript.', s: { subject: 'JavaScript' } },
          { t: '{subject} is a scripting language that runs in web browsers.', s: { subject: 'JavaScript' } }
        ],
        explanation: 'JavaScript was created by Brendan Eich at Netscape in 1995, and its standardised specification is called ECMAScript.'
      }
    },
    {
      id: 'animal-penguin-flightless',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/penguin',
      checked: '2026-10-01',
      zh: {
        topic: '企鹅',
        claims: [
          { t: '{subject}是一类不会飞的鸟类。', s: { subject: '企鹅' } },
          { t: '{subject}主要生活在{value}。', s: { subject: '企鹅', value: '南半球' }, alt: ['北半球', '北极地区', '赤道附近'] },
          { t: '{subject}用鳍状的翅膀在水中推进。', s: { subject: '企鹅' } }
        ],
        explanation: '企鹅是不会飞的鸟类，主要分布在南半球，靠鳍状翅膀在水中高速游动。'
      },
      en: {
        topic: 'Penguins',
        claims: [
          { t: '{subject} are a group of birds that cannot fly.', s: { subject: 'Penguins' } },
          { t: '{subject} live mainly in the {value}.', s: { subject: 'Penguins', value: 'Southern Hemisphere' }, alt: ['Northern Hemisphere', 'Arctic region', 'equatorial region'] },
          { t: '{subject} use their flipper-like wings to move through water.', s: { subject: 'Penguins' } }
        ],
        explanation: 'Penguins are flightless birds found mainly in the Southern Hemisphere; they swim with flipper-like wings.'
      }
    },
    {
      id: 'lang-japanese-family',
      category: 'language',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Japanese-language',
      checked: '2026-10-01',
      zh: {
        topic: '日语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '日语', value: '日本语系' }, alt: ['汉藏语系', '印欧语系', '乌拉尔语系'] },
          { t: '{subject}的书写系统混合使用汉字与平假名、片假名。', s: { subject: '日语' } },
          { t: '{subject}使用的假名是表音文字。', s: { subject: '日语' } }
        ],
        explanation: '日语通常被归入日本语系，书写时并用汉字与两类假名，假名属于表音文字。'
      },
      en: {
        topic: 'Japanese',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Japanese', value: 'Japonic' }, alt: ['Sino-Tibetan', 'Indo-European', 'Uralic'] },
          { t: 'The writing system of {subject} combines Chinese characters with hiragana and katakana.', s: { subject: 'Japanese' } },
          { t: 'The kana used in {subject} are syllabic scripts.', s: { subject: 'Japanese' } }
        ],
        explanation: 'Japanese is usually classified in the Japonic family; it is written with Chinese characters plus two syllabic kana scripts.'
      }
    },
    {
      id: 'gen-kilogram-si-base',
      category: 'general',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'BIPM',
      sourceUrl: 'https://www.bipm.org/en/measurement-units',
      checked: '2026-10-01',
      zh: {
        topic: '千克',
        claims: [
          { t: '{subject}是国际单位制中{value}的基本单位。', s: { subject: '千克', value: '质量' }, alt: ['长度', '时间', '电流'] },
          { t: '{subject}的定义在2019年改为基于普朗克常数。', s: { subject: '千克' } },
          { t: '{subject}的符号是 {value}。', s: { subject: '千克', value: 'kg' }, alt: ['KG', 'kgs', 'lb'] }
        ],
        explanation: '千克是国际单位制的质量基本单位，符号为 kg；2019年起其定义基于普朗克常数。'
      },
      en: {
        topic: 'The kilogram',
        claims: [
          { t: '{subject} is the base unit of {value} in the International System of Units.', s: { subject: 'The kilogram', value: 'mass' }, alt: ['length', 'time', 'electric current'] },
          { t: 'The definition of {subject} was changed in 2019 to be based on the Planck constant.', s: { subject: 'the kilogram' } },
          { t: 'The symbol of {subject} is {value}.', s: { subject: 'the kilogram', value: 'kg' }, alt: ['KG', 'kgs', 'lb'] }
        ],
        explanation: 'The kilogram is the SI base unit of mass, written kg; since 2019 it is defined via the Planck constant.'
      }
    },
    {
      id: 'geo-everest-highest',
      category: 'geography',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Mount-Everest',
      checked: '2026-10-01',
      zh: {
        topic: '珠穆朗玛峰',
        claims: [
          { t: '{subject}位于{value}山脉。', s: { subject: '珠穆朗玛峰', value: '喜马拉雅' }, alt: ['阿尔卑斯', '安第斯', '落基'] },
          { t: '{subject}的海拔约为 {n} 米。', s: { subject: '珠穆朗玛峰', n: '8849' }, num: { min: 1000, max: 20000 } },
          { t: '{subject}是世界上海拔最高的山峰。', s: { subject: '珠穆朗玛峰' } }
        ],
        explanation: '珠穆朗玛峰位于喜马拉雅山脉，海拔约8849米，是世界上海拔最高的山峰。'
      },
      en: {
        topic: 'Mount Everest',
        claims: [
          { t: '{subject} is part of the {value} mountain range.', s: { subject: 'Mount Everest', value: 'Himalayas' }, alt: ['Alps', 'Andes', 'Rockies'] },
          { t: '{subject} rises to about {n} metres above sea level.', s: { subject: 'Mount Everest', n: '8849' }, num: { min: 1000, max: 20000 } },
          { t: '{subject} is the highest mountain above sea level in the world.', s: { subject: 'Mount Everest' } }
        ],
        explanation: 'Mount Everest lies in the Himalayas and rises about 8,849 metres above sea level, the highest of any mountain.'
      }
    },
    {
      id: 'sci-gold-symbol',
      category: 'science',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/gold-chemical-element',
      checked: '2026-10-01',
      zh: {
        topic: '金',
        claims: [
          { t: '{subject}的元素符号是{value}。', s: { subject: '金', value: 'Au' }, alt: ['Ag', 'Cu', 'Fe'] },
          { t: '{subject}的原子序数是 {n}。', s: { subject: '金', n: '79' }, num: { min: 1, max: 118 } },
          { t: '{subject}是一种在常温下呈固态的金属元素。', s: { subject: '金' } }
        ],
        explanation: '金的元素符号为 Au，来自拉丁语 aurum，原子序数为79。'
      },
      en: {
        topic: 'Gold',
        claims: [
          { t: 'The chemical symbol of {subject} is {value}.', s: { subject: 'gold', value: 'Au' }, alt: ['Ag', 'Cu', 'Fe'] },
          { t: 'The atomic number of {subject} is {n}.', s: { subject: 'gold', n: '79' }, num: { min: 1, max: 118 } },
          { t: '{subject} is a metallic element that is solid at room temperature.', s: { subject: 'Gold' } }
        ],
        explanation: 'The chemical symbol of gold is Au, from the Latin aurum, and its atomic number is 79.'
      }
    },
    {
      id: 'space-moon-distance',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/moon/',
      checked: '2026-10-01',
      zh: {
        topic: '月球',
        claims: [
          { t: '{subject}是地球唯一的天然卫星。', s: { subject: '月球' } },
          { t: '{subject}与地球的平均距离约为 {n} 万公里。', s: { subject: '月球', n: '38' }, num: { min: 1, max: 500 } },
          { t: '{subject}的引力是地球潮汐现象的主要成因。', s: { subject: '月球' } }
        ],
        explanation: '月球是地球唯一的天然卫星，平均距离约38万公里，其引力主导了地球的潮汐。'
      },
      en: {
        topic: 'The Moon',
        claims: [
          { t: '{subject} is the only natural satellite of Earth.', s: { subject: 'The Moon' } },
          { t: 'The average distance between {subject} and Earth is about {n} thousand kilometres.', s: { subject: 'the Moon', n: '384' }, num: { min: 1, max: 5000 } },
          { t: 'The gravity of {subject} is the main cause of tides on Earth.', s: { subject: 'the Moon' } }
        ],
        explanation: 'The Moon is the only natural satellite of Earth, about 384,000 kilometres away on average, and its gravity drives the tides.'
      }
    },
    {
      id: 'hist-great-wall-china',
      category: 'history',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Great-Wall-of-China',
      checked: '2026-10-01',
      zh: {
        topic: '长城',
        claims: [
          { t: '{subject}是世界上最长的城墙防御体系。', s: { subject: '长城' } },
          { t: '{subject}的修建延续了多个朝代。', s: { subject: '长城' } },
          { t: '{subject}现存主要段落的总长度超过 {n} 公里。', s: { subject: '长城', n: '21000' }, num: { min: 1000, max: 100000 } }
        ],
        explanation: '长城历经多个朝代修建，现存各时期段落的总长度超过两万公里。'
      },
      en: {
        topic: 'The Great Wall of China',
        claims: [
          { t: '{subject} is the longest defensive wall system in the world.', s: { subject: 'The Great Wall of China' } },
          { t: '{subject} was built and rebuilt over many dynasties.', s: { subject: 'The Great Wall of China' } },
          { t: 'The surviving main sections of {subject} total more than {n} kilometres.', s: { subject: 'the Great Wall of China', n: '21000' }, num: { min: 1000, max: 100000 } }
        ],
        explanation: 'The Great Wall was built and rebuilt across many dynasties; its surviving sections total more than 21,000 kilometres.'
      }
    },
    {
      id: 'tech-transistor-1947',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/transistor',
      checked: '2026-10-01',
      zh: {
        topic: '晶体管',
        claims: [
          { t: '{subject}于{value}年在贝尔实验室被发明。', s: { subject: '晶体管', value: '1947' }, alt: ['1904', '1928', '1965'] },
          { t: '{subject}是集成电路的基本组成单元。', s: { subject: '晶体管' } },
          { t: '{subject}可以用来放大或开关电信号。', s: { subject: '晶体管' } }
        ],
        explanation: '晶体管于1947年在贝尔实验室被发明，取代电子管成为电子设备的基础元件。'
      },
      en: {
        topic: 'The transistor',
        claims: [
          { t: '{subject} was invented at Bell Labs in {value}.', s: { subject: 'The transistor', value: '1947' }, alt: ['1904', '1928', '1965'] },
          { t: '{subject} is the basic building block of integrated circuits.', s: { subject: 'The transistor' } },
          { t: '{subject} can amplify or switch electrical signals.', s: { subject: 'The transistor' } }
        ],
        explanation: 'The transistor was invented at Bell Labs in 1947 and became the fundamental component of modern electronics.'
      }
    },
    {
      id: 'animal-bat-true-flight',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/bat-mammal',
      checked: '2026-10-01',
      zh: {
        topic: '蝙蝠',
        claims: [
          { t: '{subject}是唯一能够真正飞行的哺乳动物类群。', s: { subject: '蝙蝠' } },
          { t: '{subject}属于{value}动物。', s: { subject: '蝙蝠', value: '哺乳' }, alt: ['鸟', '爬行', '两栖'] },
          { t: '{subject}多依靠回声定位在黑暗中辨别方向。', s: { subject: '蝙蝠' } }
        ],
        explanation: '蝙蝠是唯一能真正飞行的哺乳动物，许多种类依靠回声定位在黑暗中导航。'
      },
      en: {
        topic: 'Bats',
        claims: [
          { t: '{subject} are the only mammals capable of true flight.', s: { subject: 'Bats' } },
          { t: '{subject} are {value}.', s: { subject: 'Bats', value: 'mammals' }, alt: ['birds', 'reptiles', 'amphibians'] },
          { t: 'Many {subject} use echolocation to navigate in the dark.', s: { subject: 'bats' } }
        ],
        explanation: 'Bats are the only mammals capable of true flight, and many species navigate by echolocation.'
      }
    },
    {
      id: 'lang-arabic-script',
      category: 'language',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Arabic-language',
      checked: '2026-10-01',
      zh: {
        topic: '阿拉伯语',
        claims: [
          { t: '{subject}的文字从右向左书写。', s: { subject: '阿拉伯语' } },
          { t: '{subject}属于{value}语系。', s: { subject: '阿拉伯语', value: '亚非' }, alt: ['印欧', '汉藏', '乌拉尔'] },
          { t: '{subject}使用阿拉伯字母书写。', s: { subject: '阿拉伯语' } }
        ],
        explanation: '阿拉伯语属亚非语系，使用阿拉伯字母，书写方向为从右向左。'
      },
      en: {
        topic: 'Arabic',
        claims: [
          { t: '{subject} is written from right to left.', s: { subject: 'Arabic' } },
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Arabic', value: 'Afro-Asiatic' }, alt: ['Indo-European', 'Sino-Tibetan', 'Uralic'] },
          { t: '{subject} is written with the Arabic alphabet.', s: { subject: 'Arabic' } }
        ],
        explanation: 'Arabic belongs to the Afro-Asiatic family and is written with the Arabic alphabet from right to left.'
      }
    },
    {
      id: 'gen-second-si-base',
      category: 'general',
      type: 'attribute',
      baseDifficulty: 3,
      sourceName: 'BIPM',
      sourceUrl: 'https://www.bipm.org/en/measurement-units',
      checked: '2026-10-01',
      zh: {
        topic: '秒',
        claims: [
          { t: '{subject}是国际单位制中时间的基本单位。', s: { subject: '秒' } },
          { t: '{subject}的现行定义基于{value}原子的跃迁频率。', s: { subject: '秒', value: '铯-133' }, alt: ['氢-1', '碳-12', '铀-235'] },
          { t: '{subject}的符号是 {value}。', s: { subject: '秒', value: 's' }, alt: ['sec', 'S', 't'] }
        ],
        explanation: '秒是国际单位制的时间基本单位，符号为 s，其定义基于铯-133原子的跃迁频率。'
      },
      en: {
        topic: 'The second',
        claims: [
          { t: '{subject} is the base unit of time in the International System of Units.', s: { subject: 'The second' } },
          { t: 'The current definition of {subject} is based on the transition frequency of the {value} atom.', s: { subject: 'the second', value: 'caesium-133' }, alt: ['hydrogen-1', 'carbon-12', 'uranium-235'] },
          { t: 'The symbol of {subject} is {value}.', s: { subject: 'the second', value: 's' }, alt: ['sec', 'S', 't'] }
        ],
        explanation: 'The second is the SI base unit of time, written s, and is defined by the transition frequency of caesium-133.'
      }
    },
    {
      id: 'geo-japan-capital',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Japan',
      checked: '2026-10-01',
      zh: {
        topic: '日本',
        claims: [
          { t: '{subject}的首都是{value}。', s: { subject: '日本', value: '东京' }, alt: ['大阪', '京都', '名古屋'] },
          { t: '{subject}是位于亚洲东部的岛国。', s: { subject: '日本' } },
          { t: '{subject}的陆地面积约为 {n} 万平方公里。', s: { subject: '日本', n: '38' }, num: { min: 1, max: 10000 } }
        ],
        explanation: '东京是日本的首都，日本是位于亚洲东部的群岛国家，陆地面积约38万平方公里。'
      },
      en: {
        topic: 'Japan',
        claims: [
          { t: 'The capital of {subject} is {value}.', s: { subject: 'Japan', value: 'Tokyo' }, alt: ['Osaka', 'Kyoto', 'Nagoya'] },
          { t: '{subject} is an island country in eastern Asia.', s: { subject: 'Japan' } },
          { t: '{subject} covers about {n} thousand square kilometres.', s: { subject: 'Japan', n: '380' }, num: { min: 1, max: 100000 } }
        ],
        explanation: 'Tokyo is the capital of Japan, an island country in eastern Asia with a land area of about 380,000 square kilometres.'
      }
    },
    {
      id: 'sci-dna-double-helix',
      category: 'science',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/DNA',
      checked: '2026-10-01',
      zh: {
        topic: 'DNA',
        claims: [
          { t: '{subject}通常呈双螺旋结构。', s: { subject: 'DNA' } },
          { t: '{subject}由 {n} 种碱基构成。', s: { subject: 'DNA', n: '4' }, num: { min: 1, max: 20 } },
          { t: '{subject}携带生物的遗传信息。', s: { subject: 'DNA' } }
        ],
        explanation: 'DNA 通常呈双螺旋结构，由腺嘌呤、鸟嘌呤、胞嘧啶和胸腺嘧啶四种碱基构成，携带遗传信息。'
      },
      en: {
        topic: 'DNA',
        claims: [
          { t: '{subject} usually takes the form of a double helix.', s: { subject: 'DNA' } },
          { t: '{subject} is made up of {n} kinds of bases.', s: { subject: 'DNA', n: '4' }, num: { min: 1, max: 20 } },
          { t: '{subject} carries the genetic information of living organisms.', s: { subject: 'DNA' } }
        ],
        explanation: 'DNA usually forms a double helix, is built from four kinds of bases, and carries genetic information.'
      }
    },
    {
      id: 'space-saturn-density',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/saturn/',
      checked: '2026-10-01',
      zh: {
        topic: '土星',
        claims: [
          { t: '{subject}以其壮观的行星环著称。', s: { subject: '土星' } },
          { t: '{subject}是太阳系中平均密度最低的行星。', s: { subject: '土星' } },
          { t: '{subject}的赤道直径约为 {n} 万公里。', s: { subject: '土星', n: '12' }, num: { min: 1, max: 1000 } }
        ],
        explanation: '土星以巨大的行星环闻名，其平均密度低于水，是太阳系中密度最低的行星。'
      },
      en: {
        topic: 'Saturn',
        claims: [
          { t: '{subject} is famous for its spectacular ring system.', s: { subject: 'Saturn' } },
          { t: '{subject} is the least dense planet in the Solar System.', s: { subject: 'Saturn' } },
          { t: 'The equatorial diameter of {subject} is about {n} thousand kilometres.', s: { subject: 'Saturn', n: '120' }, num: { min: 1, max: 10000 } }
        ],
        explanation: 'Saturn is famous for its rings and has the lowest average density of any planet in the Solar System.'
      }
    },
    {
      id: 'hist-magna-carta-1215',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Magna-Carta',
      checked: '2026-10-01',
      zh: {
        topic: '大宪章',
        claims: [
          { t: '{subject}于{value}在英格兰签署。', s: { subject: '大宪章', value: '1215年' }, alt: ['1066年', '1415年', '1620年'] },
          { t: '{subject}限制了英国君主的权力。', s: { subject: '大宪章' } },
          { t: '{subject}是英格兰国王在贵族压力下签署的文件。', s: { subject: '大宪章' } }
        ],
        explanation: '1215年，英格兰国王约翰在贵族压力下签署《大宪章》，限制了王权。'
      },
      en: {
        topic: 'Magna Carta',
        claims: [
          { t: '{subject} was sealed in England in {value}.', s: { subject: 'Magna Carta', value: '1215' }, alt: ['1066', '1415', '1620'] },
          { t: '{subject} limited the power of the English monarch.', s: { subject: 'Magna Carta' } },
          { t: '{subject} was sealed by King John under pressure from his barons.', s: { subject: 'Magna Carta' } }
        ],
        explanation: 'In 1215 King John sealed Magna Carta under pressure from his barons, limiting royal power.'
      }
    },
    {
      id: 'tech-tcp-reliable',
      category: 'technology',
      type: 'attribute',
      baseDifficulty: 3,
      sourceName: 'IETF RFC 9293',
      sourceUrl: 'https://www.rfc-editor.org/rfc/rfc9293.html',
      checked: '2026-10-01',
      zh: {
        topic: 'TCP',
        claims: [
          { t: '{subject}提供面向连接的可靠数据传输。', s: { subject: 'TCP' } },
          { t: '{subject}工作在传输层。', s: { subject: 'TCP' } },
          { t: '{subject}与{value}共同构成互联网协议族的核心。', s: { subject: 'TCP', value: 'IP' }, alt: ['UDP', 'HTTP', 'FTP'] }
        ],
        explanation: 'TCP 与 IP 共同构成互联网协议族的核心；TCP 在传输层提供面向连接的可靠传输。'
      },
      en: {
        topic: 'TCP',
        claims: [
          { t: '{subject} provides reliable, connection-oriented data transfer.', s: { subject: 'TCP' } },
          { t: '{subject} operates at the transport layer.', s: { subject: 'TCP' } },
          { t: '{subject} and {value} form the core of the Internet protocol suite.', s: { subject: 'TCP', value: 'IP' }, alt: ['UDP', 'HTTP', 'FTP'] }
        ],
        explanation: 'TCP and IP form the core of the Internet protocol suite; TCP provides reliable connection-oriented transport.'
      }
    },
    {
      id: 'animal-giraffe-tallest',
      category: 'animals',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/giraffe',
      checked: '2026-10-01',
      zh: {
        topic: '长颈鹿',
        claims: [
          { t: '{subject}是现存最高的陆生动物。', s: { subject: '长颈鹿' } },
          { t: '{subject}的成年个体身高可达约 {n} 米。', s: { subject: '长颈鹿', n: '5.5' }, num: { min: 1, max: 15 } },
          { t: '{subject}的颈部也只有 {value} 块颈椎骨。', s: { subject: '长颈鹿', value: '7' }, alt: ['12', '24', '30'] }
        ],
        explanation: '长颈鹿是现存最高的陆生动物，成年个体可达约5.5米，但颈部与多数哺乳动物一样只有七块颈椎骨。'
      },
      en: {
        topic: 'The giraffe',
        claims: [
          { t: '{subject} is the tallest living land animal.', s: { subject: 'The giraffe' } },
          { t: 'An adult {subject} can stand about {n} metres tall.', s: { subject: 'giraffe', n: '5.5' }, num: { min: 1, max: 15 } },
          { t: '{subject} has only {value} neck vertebrae.', s: { subject: 'The giraffe', value: '7' }, alt: ['12', '24', '30'] }
        ],
        explanation: 'The giraffe is the tallest living land animal, reaching about 5.5 metres, yet it has only seven neck vertebrae like most mammals.'
      }
    },
    {
      id: 'lang-latin-alphabet-26',
      category: 'language',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Latin-alphabet',
      checked: '2026-10-01',
      zh: {
        topic: '拉丁字母表',
        claims: [
          { t: '{subject}在现代英语中有 {n} 个字母。', s: { subject: '拉丁字母表', n: '26' }, num: { min: 5, max: 60 } },
          { t: '{subject}源自古罗马人使用的文字。', s: { subject: '拉丁字母表' } },
          { t: '{subject}是当今世界上使用最广泛的书写系统。', s: { subject: '拉丁字母表' } }
        ],
        explanation: '拉丁字母表源自古罗马文字，现代英语使用其中26个字母，是当今使用最广的书写系统。'
      },
      en: {
        topic: 'The Latin alphabet',
        claims: [
          { t: '{subject} has {n} letters in modern English.', s: { subject: 'The Latin alphabet', n: '26' }, num: { min: 5, max: 60 } },
          { t: '{subject} descends from the writing system used in ancient Rome.', s: { subject: 'The Latin alphabet' } },
          { t: '{subject} is the most widely used writing system in the world today.', s: { subject: 'The Latin alphabet' } }
        ],
        explanation: 'The Latin alphabet descends from ancient Roman writing; modern English uses 26 of its letters, and it is the most widely used script today.'
      }
    },
    {
      id: 'gen-water-freezing-point',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/water',
      checked: '2026-10-01',
      zh: {
        topic: '纯水',
        claims: [
          { t: '{subject}在标准大气压下的凝固点是 {n} 摄氏度。', s: { subject: '纯水', n: '0' }, num: { min: -100, max: 100 } },
          { t: '{subject}结冰时体积会膨胀。', s: { subject: '纯水' } },
          { t: '{subject}是地球上最常见的液体之一。', s: { subject: '纯水' } }
        ],
        explanation: '纯水在标准大气压下0摄氏度凝固，结冰时体积膨胀，是地球上最常见的液体之一。'
      },
      en: {
        topic: 'Pure water',
        claims: [
          { t: '{subject} freezes at {n} degrees Celsius at standard atmospheric pressure.', s: { subject: 'Pure water', n: '0' }, num: { min: -100, max: 100 } },
          { t: '{subject} expands when it freezes.', s: { subject: 'Pure water' } },
          { t: '{subject} is one of the most common liquids on Earth.', s: { subject: 'Pure water' } }
        ],
        explanation: 'Pure water freezes at 0 °C at standard pressure, expands when it freezes, and is one of the most common liquids on Earth.'
      }
    },
    {
      id: 'geo-sahara-largest-hot-desert',
      category: 'geography',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Sahara',
      checked: '2026-10-01',
      zh: {
        topic: '撒哈拉沙漠',
        claims: [
          { t: '{subject}位于{value}北部。', s: { subject: '撒哈拉沙漠', value: '非洲' }, alt: ['亚洲', '南美洲', '大洋洲'] },
          { t: '{subject}是世界上面积最大的热沙漠。', s: { subject: '撒哈拉沙漠' } },
          { t: '{subject}的面积约为 {n} 万平方公里。', s: { subject: '撒哈拉沙漠', n: '920' }, num: { min: 100, max: 5000 } }
        ],
        explanation: '撒哈拉沙漠横跨非洲北部，面积约920万平方公里，是世界上最大的热沙漠。'
      },
      en: {
        topic: 'The Sahara',
        claims: [
          { t: '{subject} lies in the northern part of {value}.', s: { subject: 'The Sahara', value: 'Africa' }, alt: ['Asia', 'South America', 'Oceania'] },
          { t: '{subject} is the largest hot desert in the world.', s: { subject: 'The Sahara' } },
          { t: '{subject} covers about {n} million square kilometres.', s: { subject: 'The Sahara', n: '9.2' }, num: { min: 1, max: 100 } }
        ],
        explanation: 'The Sahara stretches across northern Africa and covers about 9.2 million square kilometres, the largest hot desert on Earth.'
      }
    },
    {
      id: 'sci-oxygen-atmosphere',
      category: 'science',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/oxygen',
      checked: '2026-10-01',
      zh: {
        topic: '氧',
        claims: [
          { t: '{subject}的元素符号是{value}。', s: { subject: '氧', value: 'O' }, alt: ['Os', 'Og', 'C'] },
          { t: '{subject}约占地球大气体积的 {n}%。', s: { subject: '氧', n: '21' }, num: { min: 0, max: 100 } },
          { t: '{subject}是地壳中含量最丰富的元素。', s: { subject: '氧' } }
        ],
        explanation: '氧的元素符号为 O，约占地球大气体积的21%，也是地壳中含量最丰富的元素。'
      },
      en: {
        topic: 'Oxygen',
        claims: [
          { t: 'The chemical symbol of {subject} is {value}.', s: { subject: 'oxygen', value: 'O' }, alt: ['Os', 'Og', 'C'] },
          { t: '{subject} makes up about {n}% of Earth’s atmosphere by volume.', s: { subject: 'Oxygen', n: '21' }, num: { min: 0, max: 100 } },
          { t: '{subject} is the most abundant element in Earth’s crust.', s: { subject: 'Oxygen' } }
        ],
        explanation: 'Oxygen has the symbol O, makes up about 21% of Earth’s atmosphere by volume, and is the most abundant element in the crust.'
      }
    },
    {
      id: 'space-sun-mass-share',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/sun/',
      checked: '2026-10-01',
      zh: {
        topic: '太阳',
        claims: [
          { t: '{subject}是太阳系中心的恒星。', s: { subject: '太阳' } },
          { t: '{subject}的质量约占整个太阳系总质量的 {n}%。', s: { subject: '太阳', n: '99.8' }, num: { min: 1, max: 100 } },
          { t: '{subject}主要通过{value}反应释放能量。', s: { subject: '太阳', value: '核聚变' }, alt: ['核裂变', '化学燃烧', '放射性衰变'] }
        ],
        explanation: '太阳是太阳系中心的恒星，其质量约占整个太阳系总质量的99.8%，能量主要来自核聚变。'
      },
      en: {
        topic: 'The Sun',
        claims: [
          { t: '{subject} is the star at the centre of the Solar System.', s: { subject: 'The Sun' } },
          { t: '{subject} contains about {n}% of the total mass of the Solar System.', s: { subject: 'The Sun', n: '99.8' }, num: { min: 1, max: 100 } },
          { t: '{subject} releases energy mainly through {value} reactions.', s: { subject: 'The Sun', value: 'nuclear fusion' }, alt: ['nuclear fission', 'chemical burning', 'radioactive decay'] }
        ],
        explanation: 'The Sun is the star at the centre of the Solar System; it holds about 99.8% of the system’s mass and shines through nuclear fusion.'
      }
    },
    {
      id: 'hist-columbus-1492',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/biography/Christopher-Columbus',
      checked: '2026-10-01',
      zh: {
        topic: '哥伦布',
        claims: [
          { t: '{subject}船队于{value}首次抵达美洲。', s: { subject: '哥伦布', value: '1492年' }, alt: ['1453年', '1519年', '1620年'] },
          { t: '{subject}的航行由西班牙王室资助。', s: { subject: '哥伦布' } },
          { t: '{subject}的船队横渡了大西洋。', s: { subject: '哥伦布' } }
        ],
        explanation: '1492年，哥伦布率领由西班牙王室资助的船队横渡大西洋，抵达美洲。'
      },
      en: {
        topic: 'Columbus',
        claims: [
          { t: '{subject} reached the Americas for the first time in {value}.', s: { subject: 'Columbus', value: '1492' }, alt: ['1453', '1519', '1620'] },
          { t: 'The voyages of {subject} were sponsored by the Spanish crown.', s: { subject: 'Columbus' } },
          { t: 'The fleet of {subject} crossed the Atlantic Ocean.', s: { subject: 'Columbus' } }
        ],
        explanation: 'In 1492 Columbus crossed the Atlantic with a fleet sponsored by the Spanish crown and reached the Americas.'
      }
    },
    {
      id: 'tech-www-berners-lee',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'CERN',
      sourceUrl: 'https://home.cern/science/computing/birth-web',
      checked: '2026-10-01',
      zh: {
        topic: '万维网',
        claims: [
          { t: '{subject}由{value}于1989年提出。', s: { subject: '万维网', value: '蒂姆·伯纳斯-李' }, alt: ['文顿·瑟夫', '林纳斯·托瓦兹', '克劳德·香农'] },
          { t: '{subject}的构想诞生于欧洲核子研究组织。', s: { subject: '万维网' } },
          { t: '{subject}使用超链接把文档连接起来。', s: { subject: '万维网' } }
        ],
        explanation: '万维网由蒂姆·伯纳斯-李于1989年在欧洲核子研究组织提出，其核心是用超链接连接文档。'
      },
      en: {
        topic: 'The World Wide Web',
        claims: [
          { t: '{subject} was proposed by {value} in 1989.', s: { subject: 'The World Wide Web', value: 'Tim Berners-Lee' }, alt: ['Vint Cerf', 'Linus Torvalds', 'Claude Shannon'] },
          { t: 'The idea of {subject} originated at CERN.', s: { subject: 'the World Wide Web' } },
          { t: '{subject} links documents together using hyperlinks.', s: { subject: 'The World Wide Web' } }
        ],
        explanation: 'The World Wide Web was proposed by Tim Berners-Lee at CERN in 1989 and links documents with hyperlinks.'
      }
    },
    {
      id: 'animal-octopus-arms',
      category: 'animals',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/octopus-mollusk',
      checked: '2026-10-01',
      zh: {
        topic: '章鱼',
        claims: [
          { t: '{subject}属于{value}动物。', s: { subject: '章鱼', value: '软体' }, alt: ['节肢', '腔肠', '棘皮'] },
          { t: '{subject}通常有 {n} 条腕足。', s: { subject: '章鱼', n: '8' }, num: { min: 1, max: 20 } },
          { t: '{subject}的血液中含有血蓝蛋白。', s: { subject: '章鱼' } }
        ],
        explanation: '章鱼是软体动物，有八条腕足，血液中含血蓝蛋白，因此呈蓝色。'
      },
      en: {
        topic: 'The octopus',
        claims: [
          { t: '{subject} is a {value}.', s: { subject: 'The octopus', value: 'mollusc' }, alt: ['arthropod', 'cnidarian', 'echinoderm'] },
          { t: '{subject} usually has {n} arms.', s: { subject: 'The octopus', n: '8' }, num: { min: 1, max: 20 } },
          { t: 'The blood of {subject} contains haemocyanin.', s: { subject: 'the octopus' } }
        ],
        explanation: 'The octopus is a mollusc with eight arms, and its blood contains haemocyanin, which makes it blue.'
      }
    },
    {
      id: 'lang-sanskrit-indo-european',
      category: 'language',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Sanskrit-language',
      checked: '2026-10-01',
      zh: {
        topic: '梵语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '梵语', value: '印欧' }, alt: ['汉藏', '达罗毗荼', '南岛'] },
          { t: '{subject}是古印度重要的书面语言。', s: { subject: '梵语' } },
          { t: '{subject}是许多现代南亚语言的词汇来源之一。', s: { subject: '梵语' } }
        ],
        explanation: '梵语属印欧语系，是古印度重要的书面语言，也为许多现代南亚语言提供了大量词汇。'
      },
      en: {
        topic: 'Sanskrit',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Sanskrit', value: 'Indo-European' }, alt: ['Sino-Tibetan', 'Dravidian', 'Austronesian'] },
          { t: '{subject} was an important literary language of ancient India.', s: { subject: 'Sanskrit' } },
          { t: '{subject} is a source of vocabulary for many modern South Asian languages.', s: { subject: 'Sanskrit' } }
        ],
        explanation: 'Sanskrit belongs to the Indo-European family and was an important literary language of ancient India.'
      }
    },
    {
      id: 'gen-mile-kilometres',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NIST',
      sourceUrl: 'https://www.nist.gov/pml/weights-and-measures',
      checked: '2026-10-01',
      zh: {
        topic: '英里',
        claims: [
          { t: '{subject}大约等于 {n} 公里。', s: { subject: '1英里', n: '1.609' }, num: { min: 0.1, max: 10 } },
          { t: '{subject}是英制中的长度单位。', s: { subject: '英里' } },
          { t: '{subject}常用于道路里程的计量。', s: { subject: '英里' } }
        ],
        explanation: '1英里约等于1.609公里，是英制中的长度单位，常用于道路里程计量。'
      },
      en: {
        topic: 'The mile',
        claims: [
          { t: '{subject} is equal to about {n} kilometres.', s: { subject: 'One mile', n: '1.609' }, num: { min: 0.1, max: 10 } },
          { t: '{subject} is a unit of length in the imperial system.', s: { subject: 'The mile' } },
          { t: '{subject} is commonly used to measure road distances.', s: { subject: 'The mile' } }
        ],
        explanation: 'One mile equals about 1.609 kilometres; it is an imperial unit of length used for road distances.'
      }
    },
    {
      id: 'geo-australia-capital',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Canberra',
      checked: '2026-10-01',
      zh: {
        topic: '澳大利亚',
        claims: [
          { t: '{subject}的首都是{value}。', s: { subject: '澳大利亚', value: '堪培拉' }, alt: ['悉尼', '墨尔本', '布里斯班'] },
          { t: '{subject}是唯一独占一个大陆的国家。', s: { subject: '澳大利亚' } },
          { t: '{subject}位于南半球。', s: { subject: '澳大利亚' } }
        ],
        explanation: '堪培拉是澳大利亚的首都；澳大利亚是唯一独占整个大陆的国家，位于南半球。'
      },
      en: {
        topic: 'Australia',
        claims: [
          { t: 'The capital of {subject} is {value}.', s: { subject: 'Australia', value: 'Canberra' }, alt: ['Sydney', 'Melbourne', 'Brisbane'] },
          { t: '{subject} is the only country that occupies an entire continent.', s: { subject: 'Australia' } },
          { t: '{subject} lies in the Southern Hemisphere.', s: { subject: 'Australia' } }
        ],
        explanation: 'Canberra is the capital of Australia, the only country that occupies an entire continent, in the Southern Hemisphere.'
      }
    },
    {
      id: 'sci-photosynthesis-oxygen',
      category: 'science',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/photosynthesis',
      checked: '2026-10-01',
      zh: {
        topic: '光合作用',
        claims: [
          { t: '{subject}主要发生在植物细胞的叶绿体中。', s: { subject: '光合作用' } },
          { t: '{subject}的过程会释放{value}。', s: { subject: '光合作用', value: '氧气' }, alt: ['氮气', '二氧化碳', '氢气'] },
          { t: '{subject}需要光能作为能量来源。', s: { subject: '光合作用' } }
        ],
        explanation: '光合作用主要在叶绿体中进行，以光能为能量来源，并把氧气释放到大气中。'
      },
      en: {
        topic: 'Photosynthesis',
        claims: [
          { t: '{subject} takes place mainly in the chloroplasts of plant cells.', s: { subject: 'Photosynthesis' } },
          { t: 'The process of {subject} releases {value}.', s: { subject: 'photosynthesis', value: 'oxygen' }, alt: ['nitrogen', 'carbon dioxide', 'hydrogen'] },
          { t: '{subject} requires light energy as its energy source.', s: { subject: 'Photosynthesis' } }
        ],
        explanation: 'Photosynthesis takes place mainly in chloroplasts, uses light energy, and releases oxygen.'
      }
    },
    {
      id: 'space-venus-hottest',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/venus/',
      checked: '2026-10-01',
      zh: {
        topic: '金星',
        claims: [
          { t: '{subject}是太阳系中表面温度最高的行星。', s: { subject: '金星' } },
          { t: '{subject}的表面平均温度约为 {n} 摄氏度。', s: { subject: '金星', n: '465' }, num: { min: -100, max: 1000 } },
          { t: '{subject}是距离太阳第二近的行星。', s: { subject: '金星' } }
        ],
        explanation: '金星是距太阳第二近的行星，浓密的二氧化碳大气造成强烈温室效应，表面约465摄氏度。'
      },
      en: {
        topic: 'Venus',
        claims: [
          { t: '{subject} has the hottest surface of any planet in the Solar System.', s: { subject: 'Venus' } },
          { t: 'The average surface temperature of {subject} is about {n} degrees Celsius.', s: { subject: 'Venus', n: '465' }, num: { min: -100, max: 1000 } },
          { t: '{subject} is the second planet from the Sun.', s: { subject: 'Venus' } }
        ],
        explanation: 'Venus is the second planet from the Sun; its thick carbon dioxide atmosphere traps heat, giving a surface near 465 °C.'
      }
    },
    {
      id: 'hist-giza-pyramids',
      category: 'history',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Pyramids-of-Giza',
      checked: '2026-10-01',
      zh: {
        topic: '吉萨金字塔群',
        claims: [
          { t: '{subject}中最大的一座是为法老胡夫修建的。', s: { subject: '吉萨金字塔群' } },
          { t: '{subject}位于{value}附近。', s: { subject: '吉萨金字塔群', value: '开罗' }, alt: ['亚历山大', '卢克索', '阿斯旺'] },
          { t: '{subject}的建造时间距今约 {n} 千年。', s: { subject: '吉萨金字塔群', n: '4.5' }, num: { min: 1, max: 10 } }
        ],
        explanation: '吉萨金字塔群位于开罗附近，其中最大的一座是胡夫金字塔，建于约4500年前。'
      },
      en: {
        topic: 'The Pyramids of Giza',
        claims: [
          { t: 'The largest pyramid in {subject} was built for the pharaoh Khufu.', s: { subject: 'the Pyramids of Giza' } },
          { t: '{subject} stand near {value}.', s: { subject: 'The Pyramids of Giza', value: 'Cairo' }, alt: ['Alexandria', 'Luxor', 'Aswan'] },
          { t: '{subject} were built about {n} thousand years ago.', s: { subject: 'The Pyramids of Giza', n: '4.5' }, num: { min: 1, max: 10 } }
        ],
        explanation: 'The Pyramids of Giza stand near Cairo; the largest was built for Khufu about 4,500 years ago.'
      }
    },
    {
      id: 'tech-c-language-ritchie',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/C-computer-programming-language',
      checked: '2026-10-01',
      zh: {
        topic: 'C语言',
        claims: [
          { t: '{subject}由{value}在贝尔实验室开发。', s: { subject: 'C语言', value: '丹尼斯·里奇' }, alt: ['比雅尼·斯特劳斯特鲁普', '吉多·范罗苏姆', '詹姆斯·高斯林'] },
          { t: '{subject}诞生于 {n} 年前后。', s: { subject: 'C语言', n: '1972' }, num: { min: 1900, max: 2000 } },
          { t: '{subject}是许多现代编程语言的重要基础。', s: { subject: 'C语言' } }
        ],
        explanation: 'C语言由丹尼斯·里奇在贝尔实验室开发，诞生于20世纪70年代初，对后世编程语言影响深远。'
      },
      en: {
        topic: 'The C language',
        claims: [
          { t: '{subject} was developed by {value} at Bell Labs.', s: { subject: 'The C language', value: 'Dennis Ritchie' }, alt: ['Bjarne Stroustrup', 'Guido van Rossum', 'James Gosling'] },
          { t: '{subject} was created around {n}.', s: { subject: 'The C language', n: '1972' }, num: { min: 1900, max: 2000 } },
          { t: '{subject} is a foundational language for many modern programming languages.', s: { subject: 'The C language' } }
        ],
        explanation: 'The C language was developed by Dennis Ritchie at Bell Labs in the early 1970s and strongly influenced later languages.'
      }
    },
    {
      id: 'animal-honeybee-pollination',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/honeybee',
      checked: '2026-10-01',
      zh: {
        topic: '蜜蜂',
        claims: [
          { t: '{subject}是重要的传粉昆虫。', s: { subject: '蜜蜂' } },
          { t: '{subject}属于{value}。', s: { subject: '蜜蜂', value: '昆虫' }, alt: ['甲壳动物', '蛛形动物', '环节动物'] },
          { t: '{subject}用蜂蜡建造六边形的巢室。', s: { subject: '蜜蜂' } }
        ],
        explanation: '蜜蜂是重要的传粉昆虫，属于昆虫纲，用蜂蜡筑成六边形的巢室。'
      },
      en: {
        topic: 'Honeybees',
        claims: [
          { t: '{subject} are important pollinating insects.', s: { subject: 'Honeybees' } },
          { t: '{subject} are {value}.', s: { subject: 'Honeybees', value: 'insects' }, alt: ['crustaceans', 'arachnids', 'annelids'] },
          { t: '{subject} build six-sided cells out of beeswax.', s: { subject: 'Honeybees' } }
        ],
        explanation: 'Honeybees are important pollinators, are insects, and build six-sided cells from beeswax.'
      }
    },
    {
      id: 'lang-hebrew-revival',
      category: 'language',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Hebrew-language',
      checked: '2026-10-01',
      zh: {
        topic: '希伯来语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '希伯来语', value: '亚非' }, alt: ['印欧', '汉藏', '尼日尔-刚果'] },
          { t: '{subject}在20世纪被重新恢复为日常口语。', s: { subject: '希伯来语' } },
          { t: '{subject}的文字从右向左书写。', s: { subject: '希伯来语' } }
        ],
        explanation: '希伯来语属亚非语系，书写方向为从右向左，并在20世纪被成功恢复为日常口语。'
      },
      en: {
        topic: 'Hebrew',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Hebrew', value: 'Afro-Asiatic' }, alt: ['Indo-European', 'Sino-Tibetan', 'Niger-Congo'] },
          { t: '{subject} was revived as an everyday spoken language in the 20th century.', s: { subject: 'Hebrew' } },
          { t: '{subject} is written from right to left.', s: { subject: 'Hebrew' } }
        ],
        explanation: 'Hebrew belongs to the Afro-Asiatic family, is written right to left, and was revived as an everyday spoken language in the 20th century.'
      }
    },
    {
      id: 'gen-absolute-zero',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/absolute-zero',
      checked: '2026-10-01',
      zh: {
        topic: '绝对零度',
        claims: [
          { t: '{subject}约等于零下 {n} 摄氏度。', s: { subject: '绝对零度', n: '273.15' }, num: { min: 10, max: 1000 } },
          { t: '{subject}是热力学温标的理论下限。', s: { subject: '绝对零度' } },
          { t: '{subject}对应的热力学温度是 {value} 开尔文。', s: { subject: '绝对零度', value: '0' }, alt: ['100', '273', '1000'] }
        ],
        explanation: '绝对零度约等于零下273.15摄氏度，对应0开尔文，是热力学温标的理论下限。'
      },
      en: {
        topic: 'Absolute zero',
        claims: [
          { t: '{subject} is about minus {n} degrees Celsius.', s: { subject: 'Absolute zero', n: '273.15' }, num: { min: 10, max: 1000 } },
          { t: '{subject} is the theoretical lower limit of the thermodynamic temperature scale.', s: { subject: 'Absolute zero' } },
          { t: '{subject} corresponds to {value} kelvin.', s: { subject: 'Absolute zero', value: '0' }, alt: ['100', '273', '1000'] }
        ],
        explanation: 'Absolute zero is about minus 273.15 degrees Celsius, or 0 kelvin, the theoretical lower limit of temperature.'
      }
    },
    {
      id: 'geo-andes-longest-range',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Andes-Mountains',
      checked: '2026-10-01',
      zh: {
        topic: '安第斯山脉',
        claims: [
          { t: '{subject}位于{value}洲。', s: { subject: '安第斯山脉', value: '南美' }, alt: ['北美', '欧', '非'] },
          { t: '{subject}是世界上最长的陆上山脉。', s: { subject: '安第斯山脉' } },
          { t: '{subject}全长约 {n} 公里。', s: { subject: '安第斯山脉', n: '7000' }, num: { min: 1000, max: 20000 } }
        ],
        explanation: '安第斯山脉纵贯南美洲西部，全长约7000公里，是世界上最长的陆上山脉。'
      },
      en: {
        topic: 'The Andes',
        claims: [
          { t: '{subject} are located in {value}.', s: { subject: 'The Andes', value: 'South America' }, alt: ['North America', 'Europe', 'Africa'] },
          { t: '{subject} form the longest continental mountain range in the world.', s: { subject: 'The Andes' } },
          { t: '{subject} run for about {n} kilometres.', s: { subject: 'The Andes', n: '7000' }, num: { min: 1000, max: 20000 } }
        ],
        explanation: 'The Andes run along the western edge of South America for about 7,000 kilometres, the longest continental range on Earth.'
      }
    },
    {
      id: 'sci-speed-of-sound-air',
      category: 'science',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/speed-of-sound',
      checked: '2026-10-01',
      zh: {
        topic: '声音',
        claims: [
          { t: '{subject}在20摄氏度空气中的传播速度约为每秒 {n} 米。', s: { subject: '声音', n: '343' }, num: { min: 50, max: 5000 } },
          { t: '{subject}无法在真空中传播。', s: { subject: '声音' } },
          { t: '{subject}在固体中的传播速度通常比在空气中更快。', s: { subject: '声音' } }
        ],
        explanation: '声音是机械波，必须依靠介质传播，在20摄氏度空气中速度约为每秒343米，无法穿过真空。'
      },
      en: {
        topic: 'Sound',
        claims: [
          { t: '{subject} travels through air at 20 degrees Celsius at about {n} metres per second.', s: { subject: 'Sound', n: '343' }, num: { min: 50, max: 5000 } },
          { t: '{subject} cannot travel through a vacuum.', s: { subject: 'Sound' } },
          { t: '{subject} usually travels faster in solids than in air.', s: { subject: 'Sound' } }
        ],
        explanation: 'Sound is a mechanical wave that needs a medium; it moves at about 343 metres per second in 20 °C air and cannot cross a vacuum.'
      }
    },
    {
      id: 'space-mercury-smallest',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/mercury/',
      checked: '2026-10-01',
      zh: {
        topic: '水星',
        claims: [
          { t: '{subject}是太阳系中最小的行星。', s: { subject: '水星' } },
          { t: '{subject}是距离太阳最近的行星。', s: { subject: '水星' } },
          { t: '{subject}绕太阳公转一周约需 {n} 天。', s: { subject: '水星', n: '88' }, num: { min: 1, max: 1000 } }
        ],
        explanation: '水星是太阳系中最小、也是距离太阳最近的行星，绕太阳一周约需88天。'
      },
      en: {
        topic: 'Mercury',
        claims: [
          { t: '{subject} is the smallest planet in the Solar System.', s: { subject: 'Mercury' } },
          { t: '{subject} is the closest planet to the Sun.', s: { subject: 'Mercury' } },
          { t: '{subject} takes about {n} days to orbit the Sun once.', s: { subject: 'Mercury', n: '88' }, num: { min: 1, max: 1000 } }
        ],
        explanation: 'Mercury is the smallest planet in the Solar System and the closest to the Sun, completing an orbit in about 88 days.'
      }
    },
    {
      id: 'hist-silk-road',
      category: 'history',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Silk-Road-trade-route',
      checked: '2026-10-01',
      zh: {
        topic: '丝绸之路',
        claims: [
          { t: '{subject}是连接东亚与地中海世界的古代贸易网络。', s: { subject: '丝绸之路' } },
          { t: '{subject}的名称来源于{value}贸易。', s: { subject: '丝绸之路', value: '丝绸' }, alt: ['香料', '茶叶', '瓷器'] },
          { t: '{subject}促进了东西方之间的商品与文化交流。', s: { subject: '丝绸之路' } }
        ],
        explanation: '丝绸之路是古代连接东亚与地中海世界的贸易网络，因丝绸贸易得名，也促进了文化交流。'
      },
      en: {
        topic: 'The Silk Road',
        claims: [
          { t: '{subject} was an ancient trade network linking East Asia with the Mediterranean world.', s: { subject: 'The Silk Road' } },
          { t: '{subject} took its name from the trade in {value}.', s: { subject: 'The Silk Road', value: 'silk' }, alt: ['spices', 'tea', 'porcelain'] },
          { t: '{subject} encouraged the exchange of goods and ideas between East and West.', s: { subject: 'The Silk Road' } }
        ],
        explanation: 'The Silk Road was an ancient trade network between East Asia and the Mediterranean, named after the silk trade.'
      }
    },
    {
      id: 'tech-html-markup',
      category: 'technology',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'WHATWG HTML Standard',
      sourceUrl: 'https://html.spec.whatwg.org/',
      checked: '2026-10-01',
      zh: {
        topic: 'HTML',
        claims: [
          { t: '{subject}是用于描述网页结构的标记语言。', s: { subject: 'HTML' } },
          { t: '{subject}使用标签来标记文档中的元素。', s: { subject: 'HTML' } },
          { t: '{subject}的首个版本出现在20世纪 {n} 年代初。', s: { subject: 'HTML', n: '90' }, num: { min: 50, max: 99 } }
        ],
        explanation: 'HTML 是描述网页结构的标记语言，靠标签标记文档元素，最早版本出现在20世纪90年代初。'
      },
      en: {
        topic: 'HTML',
        claims: [
          { t: '{subject} is the markup language used to describe the structure of web pages.', s: { subject: 'HTML' } },
          { t: '{subject} uses tags to mark up the elements of a document.', s: { subject: 'HTML' } },
          { t: 'The first version of {subject} appeared in the early {n}s.', s: { subject: 'HTML', n: '1990' }, num: { min: 1900, max: 2000 } }
        ],
        explanation: 'HTML is the markup language that describes the structure of web pages using tags; its first version appeared in the early 1990s.'
      }
    },
    {
      id: 'animal-monarch-migration',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/monarch-butterfly',
      checked: '2026-10-01',
      zh: {
        topic: '黑脉金斑蝶',
        claims: [
          { t: '{subject}在北美洲进行长距离的季节性迁徙。', s: { subject: '黑脉金斑蝶' } },
          { t: '{subject}的幼虫以马利筋属植物为食。', s: { subject: '黑脉金斑蝶' } },
          { t: '{subject}的翅展约为 {n} 厘米。', s: { subject: '黑脉金斑蝶', n: '10' }, num: { min: 1, max: 30 } }
        ],
        explanation: '黑脉金斑蝶在北美洲进行长距离季节性迁徙，幼虫以马利筋属植物为食，翅展约10厘米。'
      },
      en: {
        topic: 'The monarch butterfly',
        claims: [
          { t: '{subject} makes long seasonal migrations in North America.', s: { subject: 'The monarch butterfly' } },
          { t: 'The larvae of {subject} feed on milkweed plants.', s: { subject: 'the monarch butterfly' } },
          { t: 'The wingspan of {subject} is about {n} centimetres.', s: { subject: 'the monarch butterfly', n: '10' }, num: { min: 1, max: 30 } }
        ],
        explanation: 'The monarch butterfly migrates long distances in North America, its larvae feed on milkweed, and its wingspan is about 10 centimetres.'
      }
    },
    {
      id: 'lang-swahili-bantu',
      category: 'language',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Swahili-language',
      checked: '2026-10-01',
      zh: {
        topic: '斯瓦希里语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '斯瓦希里语', value: '尼日尔-刚果' }, alt: ['亚非', '印欧', '汉藏'] },
          { t: '{subject}是东非地区广泛使用的通用语。', s: { subject: '斯瓦希里语' } },
          { t: '{subject}使用拉丁字母书写。', s: { subject: '斯瓦希里语' } }
        ],
        explanation: '斯瓦希里语属尼日尔-刚果语系，是东非广泛使用的通用语，使用拉丁字母书写。'
      },
      en: {
        topic: 'Swahili',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Swahili', value: 'Niger-Congo' }, alt: ['Afro-Asiatic', 'Indo-European', 'Sino-Tibetan'] },
          { t: '{subject} is a widely used lingua franca in East Africa.', s: { subject: 'Swahili' } },
          { t: '{subject} is written with the Latin alphabet.', s: { subject: 'Swahili' } }
        ],
        explanation: 'Swahili belongs to the Niger-Congo family, serves as a lingua franca in East Africa, and is written in the Latin alphabet.'
      }
    },
    {
      id: 'gen-olympic-games-1896',
      category: 'general',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/sports/Olympic-Games',
      checked: '2026-10-01',
      zh: {
        topic: '现代奥运会',
        claims: [
          { t: '第一届现代{subject}于{value}在雅典举行。', s: { subject: '奥运会', value: '1896年' }, alt: ['1888年', '1900年', '1912年'] },
          { t: '{subject}通常每四年举办一次。', s: { subject: '现代奥运会' } },
          { t: '{subject}包括夏季和冬季两大类赛事。', s: { subject: '现代奥运会' } }
        ],
        explanation: '第一届现代奥运会于1896年在雅典举行，此后通常每四年举办一次，分为夏季与冬季赛事。'
      },
      en: {
        topic: 'The modern Olympic Games',
        claims: [
          { t: 'The first modern {subject} were held in Athens in {value}.', s: { subject: 'Olympic Games', value: '1896' }, alt: ['1888', '1900', '1912'] },
          { t: 'The modern {subject} are normally held every four years.', s: { subject: 'Olympic Games' } },
          { t: 'The modern {subject} include both Summer and Winter editions.', s: { subject: 'Olympic Games' } }
        ],
        explanation: 'The first modern Olympic Games were held in Athens in 1896; they are normally held every four years in Summer and Winter editions.'
      }
    },
    {
      id: 'geo-amazon-river-discharge',
      category: 'geography',
      type: 'attribute',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Amazon-River',
      checked: '2026-10-01',
      zh: {
        topic: '亚马逊河',
        claims: [
          { t: '{subject}注入{value}。', s: { subject: '亚马逊河', value: '大西洋' }, alt: ['太平洋', '印度洋', '北冰洋'] },
          { t: '{subject}是世界上流量最大的河流。', s: { subject: '亚马逊河' } },
          { t: '{subject}位于南美洲。', s: { subject: '亚马逊河' } }
        ],
        explanation: '亚马逊河位于南美洲，最终注入大西洋，是世界上流量最大的河流。'
      },
      en: {
        topic: 'The Amazon River',
        claims: [
          { t: '{subject} flows into the {value}.', s: { subject: 'The Amazon River', value: 'Atlantic Ocean' }, alt: ['Pacific Ocean', 'Indian Ocean', 'Arctic Ocean'] },
          { t: '{subject} has the largest discharge of any river in the world.', s: { subject: 'The Amazon River' } },
          { t: '{subject} is located in South America.', s: { subject: 'The Amazon River' } }
        ],
        explanation: 'The Amazon River lies in South America and empties into the Atlantic Ocean; it has the largest discharge of any river.'
      }
    },
    {
      id: 'sci-periodic-table-118',
      category: 'science',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'IUPAC',
      sourceUrl: 'https://iupac.org/what-we-do/periodic-table-of-elements/',
      checked: '2026-10-01',
      zh: {
        topic: '元素周期表',
        claims: [
          { t: '{subject}目前包含 {n} 种已确认的元素。', s: { subject: '元素周期表', n: '118' }, num: { min: 50, max: 200 } },
          { t: '{subject}按原子序数递增的顺序排列元素。', s: { subject: '元素周期表' } },
          { t: '{subject}由俄国化学家门捷列夫在19世纪最早系统提出。', s: { subject: '元素周期表' } }
        ],
        explanation: '元素周期表按原子序数排列元素，目前包含118种已确认元素，最早由门捷列夫在19世纪系统提出。'
      },
      en: {
        topic: 'The periodic table',
        claims: [
          { t: '{subject} currently contains {n} confirmed elements.', s: { subject: 'The periodic table', n: '118' }, num: { min: 50, max: 200 } },
          { t: '{subject} arranges the elements in order of increasing atomic number.', s: { subject: 'The periodic table' } },
          { t: '{subject} was first systematically proposed by the Russian chemist Mendeleev in the 19th century.', s: { subject: 'The periodic table' } }
        ],
        explanation: 'The periodic table arranges elements by atomic number and now lists 118 confirmed elements; Mendeleev proposed it systematically in the 19th century.'
      }
    },
    {
      id: 'space-pluto-dwarf-planet',
      category: 'space',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/dwarf-planets/pluto/',
      checked: '2026-10-01',
      zh: {
        topic: '冥王星',
        claims: [
          { t: '{subject}在2006年被国际天文学联合会重新归类为矮行星。', s: { subject: '冥王星' } },
          { t: '{subject}位于柯伊伯带。', s: { subject: '冥王星' } },
          { t: '{subject}与太阳的平均距离约为 {n} 个天文单位。', s: { subject: '冥王星', n: '39' }, num: { min: 1, max: 200 } }
        ],
        explanation: '冥王星位于柯伊伯带，与太阳平均距离约39个天文单位，2006年被重新归类为矮行星。'
      },
      en: {
        topic: 'Pluto',
        claims: [
          { t: 'In 2006 {subject} was reclassified as a dwarf planet by the International Astronomical Union.', s: { subject: 'Pluto' } },
          { t: '{subject} lies in the Kuiper Belt.', s: { subject: 'Pluto' } },
          { t: 'The average distance from {subject} to the Sun is about {n} astronomical units.', s: { subject: 'Pluto', n: '39' }, num: { min: 1, max: 200 } }
        ],
        explanation: 'Pluto orbits in the Kuiper Belt at about 39 astronomical units from the Sun and was reclassified as a dwarf planet in 2006.'
      }
    },
    {
      id: 'hist-constantinople-330',
      category: 'history',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Istanbul',
      checked: '2026-10-01',
      zh: {
        topic: '君士坦丁堡',
        claims: [
          { t: '{subject}在公元330年成为{value}帝国的首都。', s: { subject: '君士坦丁堡', value: '罗马' }, alt: ['波斯', '奥斯曼', '阿拉伯'] },
          { t: '{subject}位于博斯普鲁斯海峡沿岸。', s: { subject: '君士坦丁堡' } },
          { t: '{subject}后来成为奥斯曼帝国的都城。', s: { subject: '君士坦丁堡' } }
        ],
        explanation: '公元330年君士坦丁堡成为罗马帝国的新都，位于博斯普鲁斯海峡沿岸，后成为奥斯曼帝国的都城。'
      },
      en: {
        topic: 'Constantinople',
        claims: [
          { t: '{subject} became the capital of the {value} Empire in 330 AD.', s: { subject: 'Constantinople', value: 'Roman' }, alt: ['Persian', 'Ottoman', 'Arab'] },
          { t: '{subject} lies on the Bosporus.', s: { subject: 'Constantinople' } },
          { t: '{subject} later became the capital of the Ottoman Empire.', s: { subject: 'Constantinople' } }
        ],
        explanation: 'In 330 AD Constantinople became the capital of the Roman Empire; it lies on the Bosporus and later served as the Ottoman capital.'
      }
    },
    {
      id: 'tech-linux-kernel-1991',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/Linux',
      checked: '2026-10-01',
      zh: {
        topic: 'Linux内核',
        claims: [
          { t: '{subject}由{value}于1991年首次发布。', s: { subject: 'Linux内核', value: '林纳斯·托瓦兹' }, alt: ['理查德·斯托曼', '肯·汤普逊', '安德鲁·塔能鲍姆'] },
          { t: '{subject}以GNU通用公共许可证发布。', s: { subject: 'Linux内核' } },
          { t: '{subject}是许多操作系统发行版的核心组件。', s: { subject: 'Linux内核' } }
        ],
        explanation: 'Linux内核由林纳斯·托瓦兹于1991年首次发布，以GNU通用公共许可证授权，是众多发行版的核心。'
      },
      en: {
        topic: 'The Linux kernel',
        claims: [
          { t: '{subject} was first released by {value} in 1991.', s: { subject: 'The Linux kernel', value: 'Linus Torvalds' }, alt: ['Richard Stallman', 'Ken Thompson', 'Andrew Tanenbaum'] },
          { t: '{subject} is released under the GNU General Public License.', s: { subject: 'The Linux kernel' } },
          { t: '{subject} is the core component of many operating system distributions.', s: { subject: 'The Linux kernel' } }
        ],
        explanation: 'The Linux kernel was first released by Linus Torvalds in 1991 under the GNU General Public License and is the core of many distributions.'
      }
    },
    {
      id: 'animal-giant-panda-bear',
      category: 'animals',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/giant-panda',
      checked: '2026-10-01',
      zh: {
        topic: '大熊猫',
        claims: [
          { t: '{subject}属于{value}科。', s: { subject: '大熊猫', value: '熊' }, alt: ['猫', '浣熊', '犬'] },
          { t: '{subject}的主要食物是竹子。', s: { subject: '大熊猫' } },
          { t: '{subject}生活在中国西南部的山区。', s: { subject: '大熊猫' } }
        ],
        explanation: '大熊猫属熊科，主要食物是竹子，生活在中国西南部的山区。'
      },
      en: {
        topic: 'The giant panda',
        claims: [
          { t: '{subject} belongs to the {value} family.', s: { subject: 'The giant panda', value: 'bear' }, alt: ['cat', 'raccoon', 'dog'] },
          { t: '{subject} feeds mainly on bamboo.', s: { subject: 'The giant panda' } },
          { t: '{subject} lives in the mountains of southwestern China.', s: { subject: 'The giant panda' } }
        ],
        explanation: 'The giant panda belongs to the bear family, feeds mainly on bamboo, and lives in the mountains of southwestern China.'
      }
    },
    {
      id: 'lang-braille-six-dots',
      category: 'language',
      type: 'quantity',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Braille-writing-system',
      checked: '2026-10-01',
      zh: {
        topic: '布莱叶盲文',
        claims: [
          { t: '{subject}的基本单元最多包含 {n} 个凸点。', s: { subject: '布莱叶盲文', n: '6' }, num: { min: 1, max: 12 } },
          { t: '{subject}由{value}在19世纪发明。', s: { subject: '布莱叶盲文', value: '路易·布莱叶' }, alt: ['路易·巴斯德', '亚历山大·贝尔', '塞缪尔·莫尔斯'] },
          { t: '{subject}是一种供视障人士触摸阅读的文字系统。', s: { subject: '布莱叶盲文' } }
        ],
        explanation: '布莱叶盲文由路易·布莱叶在19世纪发明，其基本单元最多包含六个凸点，供触摸阅读。'
      },
      en: {
        topic: 'Braille',
        claims: [
          { t: 'The basic cell of {subject} contains at most {n} raised dots.', s: { subject: 'Braille', n: '6' }, num: { min: 1, max: 12 } },
          { t: '{subject} was invented by {value} in the 19th century.', s: { subject: 'Braille', value: 'Louis Braille' }, alt: ['Louis Pasteur', 'Alexander Graham Bell', 'Samuel Morse'] },
          { t: '{subject} is a writing system read by touch.', s: { subject: 'Braille' } }
        ],
        explanation: 'Braille was invented by Louis Braille in the 19th century; its basic cell has at most six raised dots and it is read by touch.'
      }
    },
    {
      id: 'gen-earth-water-coverage',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'USGS Water Science School',
      sourceUrl: 'https://www.usgs.gov/special-topics/water-science-school/science/how-much-water-there-earth',
      checked: '2026-10-01',
      zh: {
        topic: '地球',
        claims: [
          { t: '{subject}的表面约有 {n}% 被水覆盖。', s: { subject: '地球', n: '71' }, num: { min: 1, max: 100 } },
          { t: '{subject}是太阳系中已知唯一表面存在大量液态水的行星。', s: { subject: '地球' } },
          { t: '{subject}上的水以液态、固态和气态三种形态存在。', s: { subject: '地球' } }
        ],
        explanation: '地球表面约71%被水覆盖，是太阳系中已知唯一表面存在大量液态水的行星，水以三态并存。'
      },
      en: {
        topic: 'Earth',
        claims: [
          { t: 'About {n}% of the surface of {subject} is covered by water.', s: { subject: 'Earth', n: '71' }, num: { min: 1, max: 100 } },
          { t: '{subject} is the only planet known to have large amounts of liquid water on its surface.', s: { subject: 'Earth' } },
          { t: 'Water on {subject} exists as liquid, solid and gas.', s: { subject: 'Earth' } }
        ],
        explanation: 'About 71% of Earth surface is water; Earth is the only planet known to have abundant surface liquid water, present as liquid, solid and gas.'
      }
    },
    {
      id: 'geo-lake-titicaca',
      category: 'geography',
      type: 'quantity',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Lake-Titicaca',
      checked: '2026-10-01',
      zh: {
        topic: '的的喀喀湖',
        claims: [
          { t: '{subject}位于{value}高原上。', s: { subject: '的的喀喀湖', value: '安第斯' }, alt: ['青藏', '东非', '巴西'] },
          { t: '{subject}是世界上海拔最高的可通航湖泊。', s: { subject: '的的喀喀湖' } },
          { t: '{subject}的湖面海拔约为 {n} 米。', s: { subject: '的的喀喀湖', n: '3812' }, num: { min: 1000, max: 6000 } }
        ],
        explanation: '的的喀喀湖位于安第斯高原，湖面海拔约3812米，是世界上海拔最高的可通航湖泊。'
      },
      en: {
        topic: 'Lake Titicaca',
        claims: [
          { t: '{subject} lies on the {value} plateau.', s: { subject: 'Lake Titicaca', value: 'Andean' }, alt: ['Tibetan', 'East African', 'Brazilian'] },
          { t: '{subject} is the highest navigable lake in the world.', s: { subject: 'Lake Titicaca' } },
          { t: '{subject} sits at an elevation of about {n} metres above sea level.', s: { subject: 'Lake Titicaca', n: '3812' }, num: { min: 1000, max: 6000 } }
        ],
        explanation: 'Lake Titicaca lies on the Andean plateau at about 3,812 metres above sea level and is the highest navigable lake in the world.'
      }
    },
    {
      id: 'sci-human-heart-chambers',
      category: 'science',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/human-cardiovascular-system',
      checked: '2026-10-01',
      zh: {
        topic: '人的心脏',
        claims: [
          { t: '{subject}通常有 {n} 个腔室。', s: { subject: '人的心脏', n: '4' }, num: { min: 1, max: 10 } },
          { t: '{subject}的主要功能是推动血液循环。', s: { subject: '人的心脏' } },
          { t: '{subject}位于胸腔内。', s: { subject: '人的心脏' } }
        ],
        explanation: '人的心脏位于胸腔内，有四个腔室，主要功能是通过收缩把血液泵向全身。'
      },
      en: {
        topic: 'The human heart',
        claims: [
          { t: '{subject} normally has {n} chambers.', s: { subject: 'The human heart', n: '4' }, num: { min: 1, max: 10 } },
          { t: '{subject} pumps blood around the body.', s: { subject: 'The human heart' } },
          { t: '{subject} lies in the chest cavity.', s: { subject: 'The human heart' } }
        ],
        explanation: 'The human heart lies in the chest cavity, has four chambers, and pumps blood around the body.'
      }
    },
    {
      id: 'space-milky-way-galaxy',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/universe/galaxies/',
      checked: '2026-10-01',
      zh: {
        topic: '银河系',
        claims: [
          { t: '{subject}是一个棒旋星系。', s: { subject: '银河系' } },
          { t: '{subject}的直径约为 {n} 万光年。', s: { subject: '银河系', n: '10' }, num: { min: 1, max: 100 } },
          { t: '{subject}包含太阳系。', s: { subject: '银河系' } }
        ],
        explanation: '银河系是一个棒旋星系，直径约10万光年，太阳系位于其中一条旋臂上。'
      },
      en: {
        topic: 'The Milky Way',
        claims: [
          { t: '{subject} is a barred spiral galaxy.', s: { subject: 'The Milky Way' } },
          { t: 'The diameter of {subject} is about {n} thousand light-years.', s: { subject: 'the Milky Way', n: '100' }, num: { min: 1, max: 1000 } },
          { t: '{subject} contains the Solar System.', s: { subject: 'The Milky Way' } }
        ],
        explanation: 'The Milky Way is a barred spiral galaxy about 100,000 light-years across, and it contains the Solar System.'
      }
    },
    {
      id: 'hist-us-declaration-1776',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Declaration-of-Independence',
      checked: '2026-10-01',
      zh: {
        topic: '《美国独立宣言》',
        claims: [
          { t: '{subject}于{value}通过。', s: { subject: '《美国独立宣言》', value: '1776年' }, alt: ['1688年', '1789年', '1812年'] },
          { t: '{subject}宣布北美十三个殖民地脱离英国独立。', s: { subject: '《美国独立宣言》' } },
          { t: '{subject}主要由托马斯·杰斐逊起草。', s: { subject: '《美国独立宣言》' } }
        ],
        explanation: '《美国独立宣言》于1776年通过，主要由托马斯·杰斐逊起草，宣布十三个殖民地脱离英国独立。'
      },
      en: {
        topic: 'The United States Declaration of Independence',
        claims: [
          { t: '{subject} was adopted in {value}.', s: { subject: 'The United States Declaration of Independence', value: '1776' }, alt: ['1688', '1789', '1812'] },
          { t: '{subject} declared the thirteen North American colonies independent from Britain.', s: { subject: 'The United States Declaration of Independence' } },
          { t: '{subject} was drafted mainly by Thomas Jefferson.', s: { subject: 'The United States Declaration of Independence' } }
        ],
        explanation: 'The Declaration of Independence was adopted in 1776, drafted mainly by Thomas Jefferson, and declared the thirteen colonies independent.'
      }
    },
    {
      id: 'tech-email-at-sign',
      category: 'technology',
      type: 'quantity',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/email',
      checked: '2026-10-01',
      zh: {
        topic: '电子邮件',
        claims: [
          { t: '{subject}的地址使用{value}符号分隔用户名与域名。', s: { subject: '电子邮件', value: '@' }, alt: ['#', '&', '%'] },
          { t: '{subject}的首次跨主机传输实现于20世纪 {n} 年代初。', s: { subject: '电子邮件', n: '70' }, num: { min: 50, max: 99 } },
          { t: '{subject}是最早的互联网应用之一。', s: { subject: '电子邮件' } }
        ],
        explanation: '电子邮件地址用 @ 分隔用户名与域名，20世纪70年代初首次实现跨主机传输，是最早的网络应用之一。'
      },
      en: {
        topic: 'Email',
        claims: [
          { t: 'Addresses of {subject} use the {value} symbol to separate the user name from the domain.', s: { subject: 'email', value: '@' }, alt: ['#', '&', '%'] },
          { t: 'The first host-to-host {subject} transmission was achieved in the early {n}s.', s: { subject: 'email', n: '1970' }, num: { min: 1900, max: 2000 } },
          { t: '{subject} is one of the earliest Internet applications.', s: { subject: 'Email' } }
        ],
        explanation: 'Email addresses use the @ symbol between user name and domain; host-to-host transmission began in the early 1970s.'
      }
    },
    {
      id: 'animal-whale-shark-largest-fish',
      category: 'animals',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/whale-shark',
      checked: '2026-10-01',
      zh: {
        topic: '鲸鲨',
        claims: [
          { t: '{subject}是世界上体型最大的鱼类。', s: { subject: '鲸鲨' } },
          { t: '{subject}属于{value}。', s: { subject: '鲸鲨', value: '软骨鱼' }, alt: ['硬骨鱼', '哺乳动物', '爬行动物'] },
          { t: '{subject}的体长可达约 {n} 米。', s: { subject: '鲸鲨', n: '18' }, num: { min: 1, max: 30 } }
        ],
        explanation: '鲸鲨是体型最大的鱼类，属于软骨鱼，以浮游生物为食，体长可达约18米。'
      },
      en: {
        topic: 'The whale shark',
        claims: [
          { t: '{subject} is the largest fish in the world.', s: { subject: 'The whale shark' } },
          { t: '{subject} is a {value}.', s: { subject: 'The whale shark', value: 'cartilaginous fish' }, alt: ['bony fish', 'mammal', 'reptile'] },
          { t: '{subject} can reach about {n} metres in length.', s: { subject: 'The whale shark', n: '18' }, num: { min: 1, max: 30 } }
        ],
        explanation: 'The whale shark is the largest fish in the world, a cartilaginous fish that feeds on plankton and can reach about 18 metres.'
      }
    },
    {
      id: 'lang-russian-cyrillic',
      category: 'language',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Russian-language',
      checked: '2026-10-01',
      zh: {
        topic: '俄语',
        claims: [
          { t: '{subject}使用{value}字母书写。', s: { subject: '俄语', value: '西里尔' }, alt: ['拉丁', '希腊', '阿拉伯'] },
          { t: '{subject}属于{value}语系。', s: { subject: '俄语', value: '印欧' }, alt: ['乌拉尔', '阿尔泰', '汉藏'] },
          { t: '{subject}是联合国六种官方语言之一。', s: { subject: '俄语' } }
        ],
        explanation: '俄语属印欧语系，使用西里尔字母书写，是联合国六种官方语言之一。'
      },
      en: {
        topic: 'Russian',
        claims: [
          { t: '{subject} is written with the {value} alphabet.', s: { subject: 'Russian', value: 'Cyrillic' }, alt: ['Latin', 'Greek', 'Arabic'] },
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Russian', value: 'Indo-European' }, alt: ['Uralic', 'Altaic', 'Sino-Tibetan'] },
          { t: '{subject} is one of the six official languages of the United Nations.', s: { subject: 'Russian' } }
        ],
        explanation: 'Russian belongs to the Indo-European family, is written in the Cyrillic alphabet, and is one of the six official UN languages.'
      }
    },
    {
      id: 'gen-si-prefix-kilo',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'BIPM',
      sourceUrl: 'https://www.bipm.org/en/measurement-units',
      checked: '2026-10-01',
      zh: {
        topic: '国际单位制词头 kilo',
        claims: [
          { t: '{subject}表示的倍数是 {n}。', s: { subject: '国际单位制词头 kilo', n: '1000' }, num: { min: 1, max: 1000000 } },
          { t: '{subject}表示10的三次方。', s: { subject: '国际单位制词头 kilo' } },
          { t: '{subject}的符号是小写字母 k。', s: { subject: '国际单位制词头 kilo' } }
        ],
        explanation: '国际单位制词头 kilo 表示1000倍，即10的三次方，符号为小写字母 k。'
      },
      en: {
        topic: 'The SI prefix kilo',
        claims: [
          { t: '{subject} represents a factor of {n}.', s: { subject: 'The SI prefix kilo', n: '1000' }, num: { min: 1, max: 1000000 } },
          { t: '{subject} stands for ten to the power of three.', s: { subject: 'The SI prefix kilo' } },
          { t: 'The symbol of {subject} is the lowercase letter k.', s: { subject: 'the SI prefix kilo' } }
        ],
        explanation: 'The SI prefix kilo stands for a factor of 1,000, that is ten to the power of three, and its symbol is the lowercase letter k.'
      }
    },
    {
      id: 'geo-mississippi-river',
      category: 'geography',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Mississippi-River',
      checked: '2026-10-01',
      zh: {
        topic: '密西西比河',
        claims: [
          { t: '{subject}自北向南贯穿美国中部。', s: { subject: '密西西比河' } },
          { t: '{subject}全长约 {n} 公里。', s: { subject: '密西西比河', n: '3766' }, num: { min: 1000, max: 10000 } },
          { t: '{subject}最终注入墨西哥湾。', s: { subject: '密西西比河' } }
        ],
        explanation: '密西西比河自北向南贯穿美国中部，全长约3766公里，最终注入墨西哥湾。'
      },
      en: {
        topic: 'The Mississippi River',
        claims: [
          { t: '{subject} flows south through the central United States.', s: { subject: 'The Mississippi River' } },
          { t: '{subject} is about {n} kilometres long.', s: { subject: 'The Mississippi River', n: '3766' }, num: { min: 1000, max: 10000 } },
          { t: '{subject} finally empties into the Gulf of Mexico.', s: { subject: 'The Mississippi River' } }
        ],
        explanation: 'The Mississippi River flows south through the central United States for about 3,766 kilometres and empties into the Gulf of Mexico.'
      }
    },
    {
      id: 'sci-nitrogen-atmosphere',
      category: 'science',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/nitrogen',
      checked: '2026-10-01',
      zh: {
        topic: '氮',
        claims: [
          { t: '{subject}的元素符号是{value}。', s: { subject: '氮', value: 'N' }, alt: ['Ni', 'Na', 'Ne'] },
          { t: '{subject}约占地球大气体积的 {n}%。', s: { subject: '氮', n: '78' }, num: { min: 0, max: 100 } },
          { t: '{subject}在常温常压下是气体。', s: { subject: '氮' } }
        ],
        explanation: '氮的元素符号为 N，约占地球大气体积的78%，是大气中含量最高的气体。'
      },
      en: {
        topic: 'Nitrogen',
        claims: [
          { t: 'The chemical symbol of {subject} is {value}.', s: { subject: 'nitrogen', value: 'N' }, alt: ['Ni', 'Na', 'Ne'] },
          { t: '{subject} makes up about {n}% of the volume of Earth’s atmosphere.', s: { subject: 'Nitrogen', n: '78' }, num: { min: 0, max: 100 } },
          { t: '{subject} is a gas at room temperature and pressure.', s: { subject: 'Nitrogen' } }
        ],
        explanation: 'Nitrogen has the symbol N and makes up about 78% of the volume of Earth’s atmosphere, the most abundant gas there.'
      }
    },
    {
      id: 'space-halley-comet',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Halleys-Comet',
      checked: '2026-10-01',
      zh: {
        topic: '哈雷彗星',
        claims: [
          { t: '{subject}平均每隔约 {n} 年回归一次内太阳系。', s: { subject: '哈雷彗星', n: '76' }, num: { min: 1, max: 500 } },
          { t: '{subject}上一次经过近日点是在1986年。', s: { subject: '哈雷彗星' } },
          { t: '{subject}是一颗周期性彗星。', s: { subject: '哈雷彗星' } }
        ],
        explanation: '哈雷彗星是一颗周期性彗星，平均每隔约76年回归一次，上一次经过近日点是在1986年。'
      },
      en: {
        topic: 'Halley’s Comet',
        claims: [
          { t: '{subject} returns to the inner Solar System about every {n} years.', s: { subject: 'Halley’s Comet', n: '76' }, num: { min: 1, max: 500 } },
          { t: '{subject} last passed perihelion in 1986.', s: { subject: 'Halley’s Comet' } },
          { t: '{subject} is a periodic comet.', s: { subject: 'Halley’s Comet' } }
        ],
        explanation: 'Halley’s Comet is a periodic comet that returns about every 76 years; it last passed perihelion in 1986.'
      }
    },
    {
      id: 'hist-titanic-1912',
      category: 'history',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Titanic',
      checked: '2026-10-01',
      zh: {
        topic: '泰坦尼克号',
        claims: [
          { t: '{subject}于{value}沉没。', s: { subject: '泰坦尼克号', value: '1912年' }, alt: ['1898年', '1905年', '1918年'] },
          { t: '{subject}在北大西洋撞上冰山后沉没。', s: { subject: '泰坦尼克号' } },
          { t: '{subject}在首航途中沉没。', s: { subject: '泰坦尼克号' } }
        ],
        explanation: '泰坦尼克号于1912年首航途中在北大西洋撞上冰山后沉没。'
      },
      en: {
        topic: 'The Titanic',
        claims: [
          { t: '{subject} sank in {value}.', s: { subject: 'The Titanic', value: '1912' }, alt: ['1898', '1905', '1918'] },
          { t: '{subject} sank in the North Atlantic after hitting an iceberg.', s: { subject: 'The Titanic' } },
          { t: '{subject} sank on its maiden voyage.', s: { subject: 'The Titanic' } }
        ],
        explanation: 'The Titanic sank in 1912 on its maiden voyage after striking an iceberg in the North Atlantic.'
      }
    },
    {
      id: 'tech-bluetooth-name-origin',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Bluetooth SIG',
      sourceUrl: 'https://www.bluetooth.com/about-us/our-history/',
      checked: '2026-10-01',
      zh: {
        topic: '蓝牙',
        claims: [
          { t: '{subject}的名称源自一位{value}国王的绰号。', s: { subject: '蓝牙', value: '丹麦' }, alt: ['挪威', '瑞典', '英格兰'] },
          { t: '{subject}是一种短距离无线通信标准。', s: { subject: '蓝牙' } },
          { t: '{subject}常用于连接耳机、键盘等外设。', s: { subject: '蓝牙' } }
        ],
        explanation: '蓝牙的名称来自10世纪丹麦国王哈拉尔蓝牙王的绰号，是一种短距离无线通信标准。'
      },
      en: {
        topic: 'Bluetooth',
        claims: [
          { t: '{subject} takes its name from the nickname of a {value} king.', s: { subject: 'Bluetooth', value: 'Danish' }, alt: ['Norwegian', 'Swedish', 'English'] },
          { t: '{subject} is a short-range wireless communication standard.', s: { subject: 'Bluetooth' } },
          { t: '{subject} is commonly used to connect peripherals such as headphones and keyboards.', s: { subject: 'Bluetooth' } }
        ],
        explanation: 'Bluetooth is named after the nickname of a 10th-century Danish king and is a short-range wireless communication standard.'
      }
    },
    {
      id: 'animal-camel-hump-fat',
      category: 'animals',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/camel',
      checked: '2026-10-01',
      zh: {
        topic: '骆驼',
        claims: [
          { t: '{subject}的驼峰储存的是脂肪。', s: { subject: '骆驼' } },
          { t: '{subject}属于{value}动物。', s: { subject: '骆驼', value: '哺乳' }, alt: ['鸟', '爬行', '两栖'] },
          { t: '{subject}的妊娠期约为 {n} 个月。', s: { subject: '骆驼', n: '13' }, num: { min: 1, max: 30 } }
        ],
        explanation: '骆驼是哺乳动物，驼峰储存的是脂肪而非水，妊娠期约13个月。'
      },
      en: {
        topic: 'The camel',
        claims: [
          { t: 'The hump of a {subject} stores fat.', s: { subject: 'camel' } },
          { t: '{subject} are {value}.', s: { subject: 'Camels', value: 'mammals' }, alt: ['birds', 'reptiles', 'amphibians'] },
          { t: 'The gestation period of a {subject} is about {n} months.', s: { subject: 'camel', n: '13' }, num: { min: 1, max: 30 } }
        ],
        explanation: 'Camels are mammals whose humps store fat rather than water, and their gestation period is about 13 months.'
      }
    },
    {
      id: 'lang-korean-hangul',
      category: 'language',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Korean-language',
      checked: '2026-10-01',
      zh: {
        topic: '韩语',
        claims: [
          { t: '{subject}使用{value}书写。', s: { subject: '韩语', value: '谚文' }, alt: ['汉字', '假名', '西里尔字母'] },
          { t: '{subject}的文字系统在15世纪由朝鲜王朝创制。', s: { subject: '韩语' } },
          { t: '{subject}的谚文是一种表音文字。', s: { subject: '韩语' } }
        ],
        explanation: '韩语使用谚文书写，谚文是15世纪由朝鲜王朝创制的表音文字。'
      },
      en: {
        topic: 'Korean',
        claims: [
          { t: '{subject} is written with {value}.', s: { subject: 'Korean', value: 'Hangul' }, alt: ['Chinese characters', 'kana', 'the Cyrillic alphabet'] },
          { t: 'The writing system of {subject} was created by the Joseon dynasty in the 15th century.', s: { subject: 'Korean' } },
          { t: '{subject} uses Hangul, which is a phonemic script.', s: { subject: 'Korean' } }
        ],
        explanation: 'Korean is written in Hangul, a phonemic script created by the Joseon dynasty in the 15th century.'
      }
    },
    {
      id: 'gen-adult-skeleton-bones',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/human-skeleton',
      checked: '2026-10-01',
      zh: {
        topic: '成年人的骨骼',
        claims: [
          { t: '{subject}通常由 {n} 块骨组成。', s: { subject: '成年人的骨骼', n: '206' }, num: { min: 50, max: 500 } },
          { t: '{subject}是人体运动系统的重要组成部分。', s: { subject: '成年人的骨骼' } },
          { t: '{subject}中的各块骨通过关节相互连接。', s: { subject: '成年人的骨骼' } }
        ],
        explanation: '成年人的骨骼通常由206块骨组成，各骨通过关节连接，是人体运动系统的重要组成部分。'
      },
      en: {
        topic: 'The adult human skeleton',
        claims: [
          { t: '{subject} normally consists of {n} bones.', s: { subject: 'The adult human skeleton', n: '206' }, num: { min: 50, max: 500 } },
          { t: '{subject} forms a key part of the human musculoskeletal system.', s: { subject: 'The adult human skeleton' } },
          { t: 'The bones of {subject} are connected to one another by joints.', s: { subject: 'the adult human skeleton' } }
        ],
        explanation: 'The adult human skeleton normally consists of 206 bones joined by joints and is a key part of the musculoskeletal system.'
      }
    },
    {
      id: 'geo-kilimanjaro-highest-africa',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Kilimanjaro',
      checked: '2026-10-01',
      zh: {
        topic: '乞力马扎罗山',
        claims: [
          { t: '{subject}位于{value}。', s: { subject: '乞力马扎罗山', value: '坦桑尼亚' }, alt: ['肯尼亚', '埃塞俄比亚', '乌干达'] },
          { t: '{subject}是非洲最高的山峰。', s: { subject: '乞力马扎罗山' } },
          { t: '{subject}的海拔约为 {n} 米。', s: { subject: '乞力马扎罗山', n: '5895' }, num: { min: 1000, max: 20000 } }
        ],
        explanation: '乞力马扎罗山位于坦桑尼亚，海拔约5895米，是非洲最高的山峰。'
      },
      en: {
        topic: 'Mount Kilimanjaro',
        claims: [
          { t: '{subject} is located in {value}.', s: { subject: 'Mount Kilimanjaro', value: 'Tanzania' }, alt: ['Kenya', 'Ethiopia', 'Uganda'] },
          { t: '{subject} is the highest mountain in Africa.', s: { subject: 'Mount Kilimanjaro' } },
          { t: '{subject} rises to about {n} metres above sea level.', s: { subject: 'Mount Kilimanjaro', n: '5895' }, num: { min: 1000, max: 20000 } }
        ],
        explanation: 'Mount Kilimanjaro is in Tanzania and rises about 5,895 metres above sea level, the highest mountain in Africa.'
      }
    },
    {
      id: 'sci-newton-universal-gravitation',
      category: 'science',
      type: 'attribute',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/Newtons-law-of-gravitation',
      checked: '2026-10-01',
      zh: {
        topic: '万有引力定律',
        claims: [
          { t: '{subject}指出任意两个有质量的物体之间都存在相互吸引。', s: { subject: '万有引力定律' } },
          { t: '{subject}中引力的大小与两物体间距离的 {n} 次方成反比。', s: { subject: '万有引力定律', n: '2' }, num: { min: 1, max: 5 } },
          { t: '{subject}由艾萨克·牛顿在17世纪提出。', s: { subject: '万有引力定律' } }
        ],
        explanation: '万有引力定律由牛顿在17世纪提出，指出任何两个有质量的物体相互吸引，引力与距离的平方成反比。'
      },
      en: {
        topic: 'The law of universal gravitation',
        claims: [
          { t: '{subject} states that any two bodies with mass attract each other.', s: { subject: 'The law of universal gravitation' } },
          { t: 'In {subject} the force is inversely proportional to the distance raised to the power of {n}.', s: { subject: 'the law of universal gravitation', n: '2' }, num: { min: 1, max: 5 } },
          { t: '{subject} was formulated by Isaac Newton in the 17th century.', s: { subject: 'The law of universal gravitation' } }
        ],
        explanation: 'Formulated by Newton in the 17th century, the law states that any two bodies with mass attract each other with a force inversely proportional to the square of the distance.'
      }
    },
    {
      id: 'space-titan-saturn-moon',
      category: 'space',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/saturn/moons/titan/',
      checked: '2026-10-01',
      zh: {
        topic: '土卫六',
        claims: [
          { t: '{subject}是土星最大的卫星。', s: { subject: '土卫六' } },
          { t: '{subject}拥有浓厚的大气层。', s: { subject: '土卫六' } },
          { t: '{subject}围绕{value}运行。', s: { subject: '土卫六', value: '土星' }, alt: ['木星', '海王星', '天王星'] }
        ],
        explanation: '土卫六（泰坦）是土星最大的卫星，也是太阳系中唯一拥有浓厚大气层的卫星。'
      },
      en: {
        topic: 'Titan',
        claims: [
          { t: '{subject} is the largest moon of Saturn.', s: { subject: 'Titan' } },
          { t: '{subject} has a thick atmosphere.', s: { subject: 'Titan' } },
          { t: '{subject} orbits {value}.', s: { subject: 'Titan', value: 'Saturn' }, alt: ['Jupiter', 'Neptune', 'Uranus'] }
        ],
        explanation: 'Titan is the largest moon of Saturn and the only moon in the Solar System with a thick atmosphere.'
      }
    },
    {
      id: 'hist-terracotta-army',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/terracotta-army',
      checked: '2026-10-01',
      zh: {
        topic: '秦始皇兵马俑',
        claims: [
          { t: '{subject}于1974年在{value}附近被发现。', s: { subject: '秦始皇兵马俑', value: '西安' }, alt: ['洛阳', '南京', '成都'] },
          { t: '{subject}是为秦始皇陵修建的。', s: { subject: '秦始皇兵马俑' } },
          { t: '{subject}包含约 {n} 个真人大小的陶俑。', s: { subject: '秦始皇兵马俑', n: '8000' }, num: { min: 100, max: 50000 } }
        ],
        explanation: '秦始皇兵马俑于1974年在西安附近被发现，为秦始皇陵陪葬而建，包含约8000个真人大小的陶俑。'
      },
      en: {
        topic: 'The Terracotta Army',
        claims: [
          { t: '{subject} was discovered near {value} in 1974.', s: { subject: 'The Terracotta Army', value: 'Xi’an' }, alt: ['Luoyang', 'Nanjing', 'Chengdu'] },
          { t: '{subject} was created for the mausoleum of Qin Shi Huang.', s: { subject: 'The Terracotta Army' } },
          { t: '{subject} includes about {n} life-sized clay figures.', s: { subject: 'The Terracotta Army', n: '8000' }, num: { min: 100, max: 50000 } }
        ],
        explanation: 'The Terracotta Army was discovered near Xi’an in 1974, was made for the mausoleum of Qin Shi Huang, and numbers about 8,000 life-sized figures.'
      }
    },
    {
      id: 'tech-wifi-ieee-80211',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Wikipedia',
      sourceUrl: 'https://en.wikipedia.org/wiki/IEEE_802.11',
      checked: '2026-10-01',
      zh: {
        topic: 'Wi-Fi',
        claims: [
          { t: '{subject}的技术标准由IEEE以 {value} 系列编号发布。', s: { subject: 'Wi-Fi', value: '802.11' }, alt: ['802.3', '802.15', '803.11'] },
          { t: '{subject}让设备无需网线即可接入局域网。', s: { subject: 'Wi-Fi' } },
          { t: '{subject}通常工作在2.4吉赫兹或5吉赫兹频段。', s: { subject: 'Wi-Fi' } }
        ],
        explanation: 'Wi-Fi 基于 IEEE 802.11 系列标准，让设备无需网线即可接入局域网，常用频段为2.4吉赫兹和5吉赫兹。'
      },
      en: {
        topic: 'Wi-Fi',
        claims: [
          { t: 'The technical standards for {subject} are published by IEEE as the {value} family.', s: { subject: 'Wi-Fi', value: '802.11' }, alt: ['802.3', '802.15', '803.11'] },
          { t: '{subject} lets devices join a local network without a cable.', s: { subject: 'Wi-Fi' } },
          { t: '{subject} commonly operates in the 2.4 GHz or 5 GHz bands.', s: { subject: 'Wi-Fi' } }
        ],
        explanation: 'Wi-Fi is based on the IEEE 802.11 family of standards, connects devices to a local network without cables, and commonly uses the 2.4 GHz and 5 GHz bands.'
      }
    },
    {
      id: 'animal-shark-cartilage',
      category: 'animals',
      type: 'attribute',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/shark',
      checked: '2026-10-01',
      zh: {
        topic: '鲨鱼',
        claims: [
          { t: '{subject}的骨骼主要由软骨构成。', s: { subject: '鲨鱼' } },
          { t: '{subject}没有鳔。', s: { subject: '鲨鱼' } },
          { t: '{subject}属于{value}鱼类。', s: { subject: '鲨鱼', value: '软骨' }, alt: ['硬骨', '肺', '无颌'] }
        ],
        explanation: '鲨鱼属于软骨鱼类，骨骼主要由软骨构成，并且没有调节浮力的鳔。'
      },
      en: {
        topic: 'Sharks',
        claims: [
          { t: 'The skeleton of a {subject} is made mainly of cartilage.', s: { subject: 'shark' } },
          { t: '{subject} do not have a swim bladder.', s: { subject: 'Sharks' } },
          { t: '{subject} are {value} fish.', s: { subject: 'Sharks', value: 'cartilaginous' }, alt: ['bony', 'lung', 'jawless'] }
        ],
        explanation: 'Sharks are cartilaginous fish whose skeletons are made mainly of cartilage, and they have no swim bladder.'
      }
    },
    {
      id: 'lang-greek-alphabet-24',
      category: 'language',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Greek-alphabet',
      checked: '2026-10-01',
      zh: {
        topic: '希腊字母表',
        claims: [
          { t: '{subject}共有 {n} 个字母。', s: { subject: '希腊字母表', n: '24' }, num: { min: 5, max: 60 } },
          { t: '{subject}是拉丁字母和西里尔字母的共同源头之一。', s: { subject: '希腊字母表' } },
          { t: '{subject}是世界上仍在使用的最古老字母系统之一。', s: { subject: '希腊字母表' } }
        ],
        explanation: '希腊字母表共有24个字母，是拉丁字母与西里尔字母的共同源头之一，至今仍在使用。'
      },
      en: {
        topic: 'The Greek alphabet',
        claims: [
          { t: '{subject} has {n} letters.', s: { subject: 'The Greek alphabet', n: '24' }, num: { min: 5, max: 60 } },
          { t: '{subject} is one of the common ancestors of the Latin and Cyrillic alphabets.', s: { subject: 'The Greek alphabet' } },
          { t: '{subject} is one of the oldest alphabetic systems still in use.', s: { subject: 'The Greek alphabet' } }
        ],
        explanation: 'The Greek alphabet has 24 letters and is one of the common ancestors of the Latin and Cyrillic alphabets; it is still in use today.'
      }
    },
    {
      id: 'gen-abo-blood-group-system',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/blood-group',
      checked: '2026-10-01',
      zh: {
        topic: 'ABO血型系统',
        claims: [
          { t: '{subject}将人类血液分为 {n} 种主要类型。', s: { subject: 'ABO血型系统', n: '4' }, num: { min: 1, max: 20 } },
          { t: '{subject}由红细胞表面的抗原决定。', s: { subject: 'ABO血型系统' } },
          { t: '{subject}是临床输血配型的重要依据。', s: { subject: 'ABO血型系统' } }
        ],
        explanation: 'ABO血型系统根据红细胞表面的抗原分为A、B、O、AB四种主要类型，是输血配型的重要依据。'
      },
      en: {
        topic: 'The ABO blood group system',
        claims: [
          { t: '{subject} divides human blood into {n} main types.', s: { subject: 'The ABO blood group system', n: '4' }, num: { min: 1, max: 20 } },
          { t: '{subject} is determined by antigens on the surface of red blood cells.', s: { subject: 'The ABO blood group system' } },
          { t: '{subject} is important for matching blood in transfusions.', s: { subject: 'The ABO blood group system' } }
        ],
        explanation: 'The ABO system sorts blood into four main types based on antigens on red blood cells and is important for transfusion matching.'
      }
    },
    {
      id: 'geo-caspian-sea-largest-lake',
      category: 'geography',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Caspian-Sea',
      checked: '2026-10-01',
      zh: {
        topic: '里海',
        claims: [
          { t: '{subject}是世界上面积最大的内陆水体。', s: { subject: '里海' } },
          { t: '{subject}的面积约为 {n} 万平方公里。', s: { subject: '里海', n: '37' }, num: { min: 5, max: 500 } },
          { t: '{subject}的水体含盐量明显高于一般淡水湖。', s: { subject: '里海' } }
        ],
        explanation: '里海是世界上面积最大的内陆水体，面积约37万平方公里，含盐量明显高于淡水湖。'
      },
      en: {
        topic: 'The Caspian Sea',
        claims: [
          { t: '{subject} is the largest inland body of water in the world.', s: { subject: 'The Caspian Sea' } },
          { t: '{subject} covers about {n} thousand square kilometres.', s: { subject: 'The Caspian Sea', n: '371' }, num: { min: 5, max: 5000 } },
          { t: 'The water of {subject} is noticeably saltier than that of an ordinary freshwater lake.', s: { subject: 'the Caspian Sea' } }
        ],
        explanation: 'The Caspian Sea is the largest inland body of water on Earth, covering about 371,000 square kilometres, with water saltier than a freshwater lake.'
      }
    },
    {
      id: 'sci-diamond-carbon',
      category: 'science',
      type: 'relation',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/diamond',
      checked: '2026-10-01',
      zh: {
        topic: '钻石',
        claims: [
          { t: '{subject}由{value}元素构成。', s: { subject: '钻石', value: '碳' }, alt: ['硅', '铁', '钙'] },
          { t: '{subject}是已知天然矿物中硬度最高的。', s: { subject: '钻石' } },
          { t: '{subject}具有很高的折射率，因此显得格外明亮。', s: { subject: '钻石' } }
        ],
        explanation: '钻石由碳元素构成，是已知天然矿物中硬度最高的，因折射率高而显得格外明亮。'
      },
      en: {
        topic: 'Diamond',
        claims: [
          { t: '{subject} is made of the element {value}.', s: { subject: 'Diamond', value: 'carbon' }, alt: ['silicon', 'iron', 'calcium'] },
          { t: '{subject} is the hardest known naturally occurring mineral.', s: { subject: 'Diamond' } },
          { t: '{subject} has a very high refractive index, which makes it appear especially bright.', s: { subject: 'Diamond' } }
        ],
        explanation: 'Diamond is made of carbon, is the hardest known naturally occurring mineral, and appears especially bright because of its high refractive index.'
      }
    },
    {
      id: 'space-sunlight-travel-time',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/sun/',
      checked: '2026-10-01',
      zh: {
        topic: '太阳',
        claims: [
          { t: '{subject}发出的光到达地球大约需要 {n} 分钟。', s: { subject: '太阳', n: '8' }, num: { min: 1, max: 100 } },
          { t: '{subject}与地球的平均距离约为1.5亿公里。', s: { subject: '太阳' } },
          { t: '{subject}是距离地球最近的恒星。', s: { subject: '太阳' } }
        ],
        explanation: '太阳与地球平均距离约1.5亿公里，阳光到达地球约需8分钟，太阳也是距离地球最近的恒星。'
      },
      en: {
        topic: 'The Sun',
        claims: [
          { t: 'Light from {subject} takes about {n} minutes to reach Earth.', s: { subject: 'the Sun', n: '8' }, num: { min: 1, max: 100 } },
          { t: 'The average distance between {subject} and Earth is about 150 million kilometres.', s: { subject: 'the Sun' } },
          { t: '{subject} is the closest star to Earth.', s: { subject: 'The Sun' } }
        ],
        explanation: 'The Sun is about 150 million kilometres from Earth, so its light takes about 8 minutes to arrive; it is also the closest star to Earth.'
      }
    },
    {
      id: 'hist-rosetta-stone',
      category: 'history',
      type: 'quantity',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Rosetta-Stone',
      checked: '2026-10-01',
      zh: {
        topic: '罗塞塔石碑',
        claims: [
          { t: '{subject}于{value}年在埃及被发现。', s: { subject: '罗塞塔石碑', value: '1799' }, alt: ['1704', '1822', '1857'] },
          { t: '{subject}为解读古埃及象形文字提供了关键线索。', s: { subject: '罗塞塔石碑' } },
          { t: '{subject}上刻有 {n} 种不同的文字。', s: { subject: '罗塞塔石碑', n: '3' }, num: { min: 1, max: 10 } }
        ],
        explanation: '罗塞塔石碑于1799年在埃及被发现，上面刻有三种文字，为解读古埃及象形文字提供了关键线索。'
      },
      en: {
        topic: 'The Rosetta Stone',
        claims: [
          { t: '{subject} was found in Egypt in {value}.', s: { subject: 'The Rosetta Stone', value: '1799' }, alt: ['1704', '1822', '1857'] },
          { t: '{subject} provided the key to deciphering ancient Egyptian hieroglyphs.', s: { subject: 'The Rosetta Stone' } },
          { t: '{subject} bears inscriptions in {n} different scripts.', s: { subject: 'The Rosetta Stone', n: '3' }, num: { min: 1, max: 10 } }
        ],
        explanation: 'The Rosetta Stone was found in Egypt in 1799; it carries three scripts and gave the key to deciphering Egyptian hieroglyphs.'
      }
    },
    {
      id: 'tech-usb-1996',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'USB Implementers Forum',
      sourceUrl: 'https://www.usb.org/about',
      checked: '2026-10-01',
      zh: {
        topic: 'USB',
        claims: [
          { t: '{subject} 1.0 规范于 {value} 年发布。', s: { subject: 'USB', value: '1996' }, alt: ['1990', '2001', '2008'] },
          { t: '{subject}支持设备热插拔。', s: { subject: 'USB' } },
          { t: '{subject}可以为外接设备提供电力。', s: { subject: 'USB' } }
        ],
        explanation: 'USB 1.0 规范于1996年发布，支持热插拔，并可通过接口为外接设备供电。'
      },
      en: {
        topic: 'USB',
        claims: [
          { t: 'The {subject} 1.0 specification was released in {value}.', s: { subject: 'USB', value: '1996' }, alt: ['1990', '2001', '2008'] },
          { t: '{subject} supports hot swapping of devices.', s: { subject: 'USB' } },
          { t: '{subject} can supply power to attached devices.', s: { subject: 'USB' } }
        ],
        explanation: 'The USB 1.0 specification appeared in 1996; USB supports hot swapping and can supply power to attached devices.'
      }
    },
    {
      id: 'animal-earthworm-annelid',
      category: 'animals',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/earthworm',
      checked: '2026-10-01',
      zh: {
        topic: '蚯蚓',
        claims: [
          { t: '{subject}属于{value}动物。', s: { subject: '蚯蚓', value: '环节' }, alt: ['软体', '节肢', '扁形'] },
          { t: '{subject}的身体由许多相似的体节组成。', s: { subject: '蚯蚓' } },
          { t: '{subject}通过湿润的皮肤进行气体交换。', s: { subject: '蚯蚓' } }
        ],
        explanation: '蚯蚓属于环节动物，身体由许多相似体节组成，依靠湿润的皮肤进行气体交换。'
      },
      en: {
        topic: 'Earthworms',
        claims: [
          { t: '{subject} are {value}.', s: { subject: 'Earthworms', value: 'annelids' }, alt: ['molluscs', 'arthropods', 'flatworms'] },
          { t: 'The body of an {subject} is made up of many similar segments.', s: { subject: 'earthworm' } },
          { t: '{subject} exchange gases through their moist skin.', s: { subject: 'Earthworms' } }
        ],
        explanation: 'Earthworms are annelids whose bodies are made of many similar segments, and they exchange gases through moist skin.'
      }
    },
    {
      id: 'lang-finnish-uralic',
      category: 'language',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Finnish-language',
      checked: '2026-10-01',
      zh: {
        topic: '芬兰语',
        claims: [
          { t: '{subject}属于{value}语系。', s: { subject: '芬兰语', value: '乌拉尔' }, alt: ['印欧', '阿尔泰', '汉藏'] },
          { t: '{subject}与爱沙尼亚语同属一个语系。', s: { subject: '芬兰语' } },
          { t: '{subject}是一种黏着语。', s: { subject: '芬兰语' } }
        ],
        explanation: '芬兰语属乌拉尔语系，与爱沙尼亚语同源，是一种通过词缀叠加表达语法关系的黏着语。'
      },
      en: {
        topic: 'Finnish',
        claims: [
          { t: '{subject} belongs to the {value} language family.', s: { subject: 'Finnish', value: 'Uralic' }, alt: ['Indo-European', 'Altaic', 'Sino-Tibetan'] },
          { t: '{subject} belongs to the same language family as Estonian.', s: { subject: 'Finnish' } },
          { t: '{subject} is an agglutinative language.', s: { subject: 'Finnish' } }
        ],
        explanation: 'Finnish belongs to the Uralic family, is related to Estonian, and is an agglutinative language.'
      }
    },
    {
      id: 'gen-time-zones-24',
      category: 'general',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/time-zone',
      checked: '2026-10-01',
      zh: {
        topic: '时区',
        claims: [
          { t: '{subject}通过{value}。', s: { subject: '本初子午线', value: '格林尼治' }, alt: ['巴黎', '华盛顿', '东京'] },
          { t: '{subject}把全球划分为 {n} 个标准时区。', s: { subject: '理论时区系统', n: '24' }, num: { min: 1, max: 60 } },
          { t: '相邻标准{subject}之间的时间相差 {value} 小时。', s: { subject: '时区', value: '1' }, alt: ['2', '3', '12'] }
        ],
        explanation: '本初子午线通过格林尼治，理论时区系统把全球划分为24个标准时区，相邻时区相差1小时。'
      },
      en: {
        topic: 'Time zones',
        claims: [
          { t: '{subject} passes through {value}.', s: { subject: 'The prime meridian', value: 'Greenwich' }, alt: ['Paris', 'Washington', 'Tokyo'] },
          { t: 'The theoretical system of {subject} divides the globe into {n} standard time zones.', s: { subject: 'time zones', n: '24' }, num: { min: 1, max: 60 } },
          { t: 'Neighbouring standard {subject} differ by {value} hour.', s: { subject: 'time zones', value: '1' }, alt: ['2', '3', '12'] }
        ],
        explanation: 'The prime meridian runs through Greenwich; the theoretical time zone system divides the globe into 24 zones, each one hour apart.'
      }
    },
    {
      id: 'geo-angel-falls',
      category: 'geography',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/place/Angel-Falls',
      checked: '2026-10-01',
      zh: {
        topic: '安赫尔瀑布',
        claims: [
          { t: '{subject}位于{value}。', s: { subject: '安赫尔瀑布', value: '委内瑞拉' }, alt: ['巴西', '秘鲁', '哥伦比亚'] },
          { t: '{subject}是世界上最高的不间断瀑布。', s: { subject: '安赫尔瀑布' } },
          { t: '{subject}的总落差约为 {n} 米。', s: { subject: '安赫尔瀑布', n: '979' }, num: { min: 100, max: 2000 } }
        ],
        explanation: '安赫尔瀑布位于委内瑞拉，总落差约979米，是世界上最高的不间断瀑布。'
      },
      en: {
        topic: 'Angel Falls',
        claims: [
          { t: '{subject} is located in {value}.', s: { subject: 'Angel Falls', value: 'Venezuela' }, alt: ['Brazil', 'Peru', 'Colombia'] },
          { t: '{subject} is the highest uninterrupted waterfall in the world.', s: { subject: 'Angel Falls' } },
          { t: 'The total drop of {subject} is about {n} metres.', s: { subject: 'Angel Falls', n: '979' }, num: { min: 100, max: 2000 } }
        ],
        explanation: 'Angel Falls is in Venezuela and drops about 979 metres in one uninterrupted fall, the highest in the world.'
      }
    },
    {
      id: 'sci-mitochondria-atp',
      category: 'science',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/mitochondrion',
      checked: '2026-10-01',
      zh: {
        topic: '线粒体',
        claims: [
          { t: '{subject}是细胞中进行有氧呼吸的主要场所。', s: { subject: '线粒体' } },
          { t: '{subject}的主要功能是产生{value}。', s: { subject: '线粒体', value: 'ATP' }, alt: ['ADP', '葡萄糖', '乳酸'] },
          { t: '{subject}拥有自己的环状DNA。', s: { subject: '线粒体' } }
        ],
        explanation: '线粒体是细胞进行有氧呼吸的主要场所，主要功能是产生 ATP，并且拥有自己的环状DNA。'
      },
      en: {
        topic: 'Mitochondria',
        claims: [
          { t: '{subject} are the main site of aerobic respiration in the cell.', s: { subject: 'Mitochondria' } },
          { t: 'The main function of {subject} is to produce {value}.', s: { subject: 'mitochondria', value: 'ATP' }, alt: ['ADP', 'glucose', 'lactic acid'] },
          { t: '{subject} have their own circular DNA.', s: { subject: 'Mitochondria' } }
        ],
        explanation: 'Mitochondria are the main site of aerobic respiration, their main job is to produce ATP, and they carry their own circular DNA.'
      }
    },
    {
      id: 'space-andromeda-galaxy',
      category: 'space',
      type: 'quantity',
      baseDifficulty: 3,
      sourceName: 'NASA Science',
      sourceUrl: 'https://science.nasa.gov/universe/galaxies/',
      checked: '2026-10-01',
      zh: {
        topic: '仙女座星系',
        claims: [
          { t: '{subject}是距离银河系最近的大型星系。', s: { subject: '仙女座星系' } },
          { t: '{subject}与地球的距离约为 {n} 万光年。', s: { subject: '仙女座星系', n: '250' }, num: { min: 1, max: 10000 } },
          { t: '{subject}在夜空中可以用肉眼看到。', s: { subject: '仙女座星系' } }
        ],
        explanation: '仙女座星系是距离银河系最近的大型星系，距地球约250万光年，在夜空中可用肉眼看到。'
      },
      en: {
        topic: 'The Andromeda Galaxy',
        claims: [
          { t: '{subject} is the nearest large galaxy to the Milky Way.', s: { subject: 'The Andromeda Galaxy' } },
          { t: 'The distance from Earth to {subject} is about {n} million light-years.', s: { subject: 'the Andromeda Galaxy', n: '2.5' }, num: { min: 1, max: 100 } },
          { t: '{subject} can be seen with the naked eye in the night sky.', s: { subject: 'The Andromeda Galaxy' } }
        ],
        explanation: 'The Andromeda Galaxy is the nearest large galaxy to the Milky Way, about 2.5 million light-years away, and is visible to the naked eye.'
      }
    },
    {
      id: 'hist-colosseum-80-ad',
      category: 'history',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Colosseum',
      checked: '2026-10-01',
      zh: {
        topic: '罗马斗兽场',
        claims: [
          { t: '{subject}位于{value}。', s: { subject: '罗马斗兽场', value: '罗马' }, alt: ['雅典', '庞贝', '那不勒斯'] },
          { t: '{subject}于公元 {n} 年落成。', s: { subject: '罗马斗兽场', n: '80' }, num: { min: 1, max: 500 } },
          { t: '{subject}是古罗马最大的圆形竞技场。', s: { subject: '罗马斗兽场' } }
        ],
        explanation: '罗马斗兽场位于罗马，于公元80年落成，是古罗马规模最大的圆形竞技场。'
      },
      en: {
        topic: 'The Colosseum',
        claims: [
          { t: '{subject} is located in {value}.', s: { subject: 'The Colosseum', value: 'Rome' }, alt: ['Athens', 'Pompeii', 'Naples'] },
          { t: '{subject} was completed in {n} AD.', s: { subject: 'The Colosseum', n: '80' }, num: { min: 1, max: 500 } },
          { t: '{subject} was the largest amphitheatre in ancient Rome.', s: { subject: 'The Colosseum' } }
        ],
        explanation: 'The Colosseum stands in Rome, was completed in 80 AD, and was the largest amphitheatre of ancient Rome.'
      }
    },
    {
      id: 'tech-turing-machine-1936',
      category: 'technology',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/technology/Turing-machine',
      checked: '2026-10-01',
      zh: {
        topic: '图灵机',
        claims: [
          { t: '{subject}由{value}在1936年提出。', s: { subject: '图灵机', value: '艾伦·图灵' }, alt: ['约翰·冯·诺依曼', '克劳德·香农', '查尔斯·巴贝奇'] },
          { t: '{subject}是计算理论中的一种抽象计算模型。', s: { subject: '图灵机' } },
          { t: '{subject}由一条可读写的无限纸带和一个读写头组成。', s: { subject: '图灵机' } }
        ],
        explanation: '图灵机由艾伦·图灵在1936年提出，是计算理论中的抽象模型，由无限纸带和读写头组成。'
      },
      en: {
        topic: 'The Turing machine',
        claims: [
          { t: '{subject} was proposed by {value} in 1936.', s: { subject: 'The Turing machine', value: 'Alan Turing' }, alt: ['John von Neumann', 'Claude Shannon', 'Charles Babbage'] },
          { t: '{subject} is an abstract model of computation in theoretical computer science.', s: { subject: 'The Turing machine' } },
          { t: '{subject} consists of an infinite tape and a read-write head.', s: { subject: 'The Turing machine' } }
        ],
        explanation: 'The Turing machine was proposed by Alan Turing in 1936 as an abstract model of computation built from an infinite tape and a read-write head.'
      }
    },
    {
      id: 'animal-kangaroo-marsupial',
      category: 'animals',
      type: 'relation',
      baseDifficulty: 2,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/animal/kangaroo',
      checked: '2026-10-01',
      zh: {
        topic: '袋鼠',
        claims: [
          { t: '{subject}属于{value}动物。', s: { subject: '袋鼠', value: '有袋' }, alt: ['胎盘', '单孔', '鳍足'] },
          { t: '{subject}的幼崽在母体的育儿袋中继续发育。', s: { subject: '袋鼠' } },
          { t: '{subject}是现存体型最大的有袋类动物。', s: { subject: '袋鼠' } }
        ],
        explanation: '袋鼠是有袋类动物，幼崽在母体育儿袋中继续发育，其中红大袋鼠是现存最大的有袋类。'
      },
      en: {
        topic: 'Kangaroos',
        claims: [
          { t: '{subject} are {value}.', s: { subject: 'Kangaroos', value: 'marsupials' }, alt: ['placental mammals', 'monotremes', 'pinnipeds'] },
          { t: 'The young of a {subject} continue to develop in the mother’s pouch.', s: { subject: 'kangaroo' } },
          { t: '{subject} are the largest living marsupials.', s: { subject: 'Kangaroos' } }
        ],
        explanation: 'Kangaroos are marsupials whose young develop further in the mother’s pouch, and they are the largest living marsupials.'
      }
    },
    {
      id: 'lang-esperanto-zamenhof',
      category: 'language',
      type: 'relation',
      baseDifficulty: 3,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/topic/Esperanto',
      checked: '2026-10-01',
      zh: {
        topic: '世界语',
        claims: [
          { t: '{subject}由{value}在1887年创造。', s: { subject: '世界语', value: '柴门霍夫' }, alt: ['托尔金', '奥威尔', '皮亚诺'] },
          { t: '{subject}是一种人为设计的国际辅助语。', s: { subject: '世界语' } },
          { t: '{subject}的词汇主要来自欧洲语言。', s: { subject: '世界语' } }
        ],
        explanation: '世界语由柴门霍夫在1887年创造，是一种人为设计的国际辅助语，词汇主要取自欧洲语言。'
      },
      en: {
        topic: 'Esperanto',
        claims: [
          { t: '{subject} was created by {value} in 1887.', s: { subject: 'Esperanto', value: 'L. L. Zamenhof' }, alt: ['J. R. R. Tolkien', 'George Orwell', 'Giuseppe Peano'] },
          { t: '{subject} is a constructed international auxiliary language.', s: { subject: 'Esperanto' } },
          { t: 'The vocabulary of {subject} is drawn mainly from European languages.', s: { subject: 'Esperanto' } }
        ],
        explanation: 'Esperanto was created by L. L. Zamenhof in 1887 as a constructed international auxiliary language with vocabulary drawn mainly from European languages.'
      }
    },
    {
      id: 'gen-pi-value',
      category: 'general',
      type: 'quantity',
      baseDifficulty: 1,
      sourceName: 'Encyclopaedia Britannica',
      sourceUrl: 'https://www.britannica.com/science/pi-mathematics',
      checked: '2026-10-01',
      zh: {
        topic: '圆周率',
        claims: [
          { t: '{subject}的近似值约为 {n}。', s: { subject: '圆周率', n: '3.14159' }, num: { min: 1, max: 10 } },
          { t: '{subject}是圆的周长与直径之比。', s: { subject: '圆周率' } },
          { t: '{subject}是一个无理数。', s: { subject: '圆周率' } }
        ],
        explanation: '圆周率是圆的周长与直径之比，约为3.14159，是一个无理数。'
      },
      en: {
        topic: 'Pi',
        claims: [
          { t: 'The approximate value of {subject} is {n}.', s: { subject: 'pi', n: '3.14159' }, num: { min: 1, max: 10 } },
          { t: '{subject} is the ratio of the circumference of a circle to its diameter.', s: { subject: 'Pi' } },
          { t: '{subject} is an irrational number.', s: { subject: 'Pi' } }
        ],
        explanation: 'Pi is the ratio of a circle’s circumference to its diameter; it is approximately 3.14159 and is an irrational number.'
      }
    }

  ];

  global.HuntContent = { CATEGORIES: CATEGORIES, facts: facts };
})(window);
