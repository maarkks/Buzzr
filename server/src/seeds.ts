import type { GameData } from '@buzzr/shared';

function cat(name: string, clues: [string, string, boolean?][]) {
  return {
    name,
    clues: clues.map(([question, answer, dailyDouble]) => ({ question, answer, ...(dailyDouble ? { dailyDouble: true } : {}) })),
  };
}

const generalKnowledge: GameData = {
  title: 'General Knowledge Night',
  description: 'A crowd-pleasing starter board: geography, movies, food, science and wordplay. Great for a first game of Buzzr.',
  tags: ['trivia', 'general', 'party'],
  rounds: [
    {
      name: 'Round 1',
      values: [100, 200, 300, 400, 500],
      categories: [
        cat('World Geography', [
          ['This is the longest river in the world (by most measures)', 'What is the Nile?'],
          ['This country has the most natural lakes', 'What is Canada?'],
          ['Mount Kilimanjaro is in this country', 'What is Tanzania?'],
          ['This is the only continent that lies in all four hemispheres', 'What is Africa?'],
          ['The Strait of Malacca connects the Indian Ocean to this sea', 'What is the South China Sea?'],
        ]),
        cat('Movie Quotes', [
          ['"May the Force be with you"', 'What is Star Wars?'],
          ['"Life is like a box of chocolates"', 'What is Forrest Gump?'],
          ['"Here\'s looking at you, kid"', 'What is Casablanca?', true],
          ['"I\'m gonna make him an offer he can\'t refuse"', 'What is The Godfather?'],
          ['"You can\'t handle the truth!"', 'What is A Few Good Men?'],
        ]),
        cat('Food & Drink', [
          ['Sushi rice is seasoned with this acidic ingredient', 'What is rice vinegar?'],
          ['This Italian cheese is traditionally used on top of pasta carbonara', 'What is Pecorino Romano?'],
          ['Hummus is primarily made from this legume', 'What are chickpeas?'],
          ['This spirit is the base of a classic margarita', 'What is tequila?'],
          ['The Maillard reaction is responsible for this color change in cooking', 'What is browning?'],
        ]),
        cat('Science Lite', [
          ['H2O is the chemical formula for this', 'What is water?'],
          ['This planet is known as the Red Planet', 'What is Mars?'],
          ['The speed of light is roughly this many kilometers per second (to the nearest 100,000)', 'What is 300,000 km/s?'],
          ['This force keeps planets in orbit around the sun', 'What is gravity?'],
          ['DNA stands for this', 'What is deoxyribonucleic acid?'],
        ]),
        cat('Word Play', [
          ['A word that reads the same forwards and backwards', 'What is a palindrome?'],
          ['"Listen" and "silent" are examples of these', 'What are anagrams?'],
          ['The dot over a lowercase i or j has this name', 'What is a tittle?'],
          ['A new word formed by blending two words, like "brunch"', 'What is a portmanteau?'],
          ['This is the only common English word ending in "-mt"', 'What is dreamt?'],
        ]),
      ],
    },
    {
      name: 'Double Round',
      values: [200, 400, 600, 800, 1000],
      categories: [
        cat('History', [
          ['The Great Wall is primarily located in this country', 'What is China?'],
          ['This ship sank on its maiden voyage in 1912', 'What is the Titanic?'],
          ['The Berlin Wall fell in this year', 'What is 1989?'],
          ['This ancient wonder stood in Alexandria, Egypt', 'What is the Lighthouse (Pharos) of Alexandria?', true],
          ['The Magna Carta was signed in this century', 'What is the 13th century (1215)?'],
        ]),
        cat('Music', [
          ['This "King of Pop" released Thriller', 'Who is Michael Jackson?'],
          ['The four members of this band were John, Paul, George and Ringo', 'Who are The Beatles?'],
          ['A standard guitar has this many strings', 'What is six?'],
          ['This composer wrote the Ninth Symphony while almost completely deaf', 'Who is Beethoven?'],
          ['This 1970s Swedish group won Eurovision with "Waterloo"', 'Who is ABBA?'],
        ]),
        cat('Sports', [
          ['A perfect game in bowling scores this many points', 'What is 300?'],
          ['This country has won the most FIFA World Cups', 'What is Brazil?'],
          ['In tennis, this is the term for a score of zero', 'What is love?'],
          ['The Olympics are held every this-many years (summer games)', 'What is four?'],
          ['This boxer was known as "The Greatest" and floated like a butterfly', 'Who is Muhammad Ali?'],
        ]),
        cat('Technology', [
          ['This company makes the iPhone', 'What is Apple?'],
          ['WWW stands for this', 'What is the World Wide Web?'],
          ['This is the binary number for the decimal 2', 'What is 10?'],
          ['Ada Lovelace is often called the first one of these', 'What is a computer programmer?'],
          ['CPU stands for this', 'What is the Central Processing Unit?', true],
        ]),
        cat('Animal Kingdom', [
          ['This is the largest animal ever known to have lived', 'What is the blue whale?'],
          ['A group of lions is called this', 'What is a pride?'],
          ['This flightless bird is the fastest runner on two legs', 'What is the ostrich?'],
          ['Octopuses have this many hearts', 'What is three?'],
          ['This is the only mammal capable of true sustained flight', 'What is the bat?'],
        ]),
      ],
    },
  ],
  final: {
    category: 'World Capitals',
    question: 'This capital city is the highest administrative capital in the world, sitting at about 3,640 m above sea level',
    answer: 'What is La Paz, Bolivia?',
  },
};

const scienceShowdown: GameData = {
  title: 'Science Showdown',
  description: 'Biology, chemistry, physics, space and famous scientists — a classroom-ready review board.',
  tags: ['science', 'school', 'review'],
  rounds: [
    {
      name: 'Round 1',
      values: [100, 200, 300, 400, 500],
      categories: [
        cat('Biology Basics', [
          ['This organelle is known as the powerhouse of the cell', 'What is the mitochondrion?'],
          ['Plants convert sunlight to energy using this process', 'What is photosynthesis?'],
          ['This molecule carries genetic information', 'What is DNA?'],
          ['Red blood cells carry oxygen using this iron-rich protein', 'What is hemoglobin?'],
          ['This kingdom includes mushrooms and yeasts', 'What is Fungi?'],
        ]),
        cat('Chemistry Corner', [
          ['This element has the symbol O', 'What is oxygen?'],
          ['The pH of a neutral solution is this number', 'What is 7?'],
          ['Table salt is made of sodium and this element', 'What is chlorine?'],
          ['This is the lightest element on the periodic table', 'What is hydrogen?', true],
          ['Diamond and graphite are both forms of this element', 'What is carbon?'],
        ]),
        cat('Physics Phun', [
          ['This is Newton\'s unit of force', 'What is the newton?'],
          ['Energy of motion is called this', 'What is kinetic energy?'],
          ['E = mc² was proposed by this physicist', 'Who is Albert Einstein?'],
          ['Sound cannot travel through this', 'What is a vacuum?'],
          ['This is the name for the bending of light as it passes between media', 'What is refraction?'],
        ]),
        cat('Space Race', [
          ['This planet is closest to the sun', 'What is Mercury?'],
          ['The first human in space was this cosmonaut', 'Who is Yuri Gagarin?'],
          ['Our galaxy has this name', 'What is the Milky Way?'],
          ['This is the largest planet in our solar system', 'What is Jupiter?'],
          ['A star\'s collapse can form this object from which light cannot escape', 'What is a black hole?'],
        ]),
        cat('Famous Scientists', [
          ['She won Nobel Prizes in both physics and chemistry', 'Who is Marie Curie?'],
          ['He proposed the theory of evolution by natural selection', 'Who is Charles Darwin?'],
          ['This mathematician is the father of computer science and broke Enigma', 'Who is Alan Turing?'],
          ['He formulated the laws of planetary motion', 'Who is Johannes Kepler?'],
          ['This naturalist wrote "Silent Spring", sparking the environmental movement', 'Who is Rachel Carson?'],
        ]),
      ],
    },
  ],
  final: {
    category: 'Periodic Table',
    question: 'This is the only letter of the alphabet that does not appear in any element\'s name or symbol',
    answer: 'What is J?',
  },
};

export const seedGames: GameData[] = [generalKnowledge, scienceShowdown];
