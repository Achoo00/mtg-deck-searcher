// app/page.tsx
"use client";

import { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import styles from './page.module.css';

interface ScryfallImageUris {
  small: string;
  normal: string;
  large: string;
  png: string;
  art_crop: string;
  border_crop: string;
}

interface ScryfallCard {
  object: string;
  id: string;
  name: string;
  image_uris?: ScryfallImageUris;
  card_faces?: Array<{ image_uris?: ScryfallImageUris }>;
}

interface Card {
  name: string;
  searchUrls: { storeName: string; url: string }[];
  imageUrl?: string | null;
  isLoadingImage: boolean;
  imageError?: boolean;
  quantity?: number;
  manaCost?: string;
  cmc?: number;
}

interface ManaPips {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
  total: number;
}

interface DeckAnalysis {
  totalCards: number;
  nonLandCards: number;
  landCards: number;
  manaPips: ManaPips;
  averageCMC: number;
  landDropProbabilities: { turn: number; probability: number }[];
}

interface OnCurveAnalysis {
  turn: number;
  targetCMC: number;
  playDraw: 'play' | 'draw';
  cardsDrawn: number;
  landProbability: number;
  spellProbability: number;
  combinedProbability: number;
  calculationDetails: {
    landCalc: { N: number; K: number; n: number; k: number };
    spellCalc: { N: number; K: number; n: number; k: number };
  };
}

interface SearchResult {
  name: string;
  id: string;
  image_uris?: ScryfallImageUris;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  cmc?: number;
}

interface DeckStatistics {
  manaCurve: { cmc: number; count: number }[];
  colorDistribution: { color: string; count: number; percentage: number }[];
  cardTypeBreakdown: { type: string; count: number; percentage: number }[];
  averageMV: number;
  commanderInfo?: {
    name: string;
    colorIdentity: string[];
    illegalCards: string[];
  };
  formatLegality: { format: string; legal: boolean; illegalCards: string[] }[];
}

interface SimulatedHand {
  cards: Array<{
    name: string;
    imageUrl?: string;
    manaCost?: string;
    typeLine?: string;
    cmc?: number;
  }>;
}

interface TwoCardComboAnalysis {
  cardA: string;
  cardB: string;
  cardsDrawn: number;
  probability: number;
  calculationDetails: {
    N: number;
    KA: number;
    KB: number;
    n: number;
  };
}

interface StormCountAnalysis {
  totalSpells: number;
  stormSpells: number;
  cantripSpells: number;
  lowCostSpells: number;
  breakdown: {
    storm: string[];
    cantrips: string[];
    lowCost: string[];
  };
}

interface MultiCriteriaSearch {
  cardName: string;
  cardType: string;
  colorIdentity: string;
  keywords: string;
  power: string;
  toughness: string;
  cmc: string;
  setCode: string;
}

interface AdvancedSearchResult {
  name: string;
  id: string;
  image_uris?: ScryfallImageUris;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  cmc?: number;
  power?: string;
  toughness?: string;
  set_name?: string;
  artist?: string;
  collector_number?: string;
  flavor_text?: string;
  legalities?: Record<string, string>;
}

interface CardDetails {
  name: string;
  oracle_text?: string;
  flavor_text?: string;
  artist?: string;
  collector_number?: string;
  set_name?: string;
  legalities?: Record<string, string>;
  image_uris?: ScryfallImageUris;
}

interface ComboCard {
  name: string;
  inDeck: boolean;
}

interface ComboResult {
  name: string;
  inDeck: boolean;
}

interface Combo {
  id: string;
  name: string;
  cards: ComboCard[];
  results: ComboResult[];
  color_identity?: string[];
  prerequisites?: string[];
  steps?: string[];
}

interface ComboDetectionAnalysis {
  combos: Combo[];
  totalCombos: number;
  deckCards: string[];
}

interface CardTypeDrawnAnalysis {
  deckSize: number;
  cardTypeCount: number;
  desiredCount: number;
  targetTurn: number;
  cardsDrawn: number;
  probability: number;
  calculationDetails: {
    N: number;
    K: number;
    n: number;
    k: number;
  };
}

interface MulliganStrategyAnalysis {
  deckSize: number;
  freeMulligan: boolean;
  cardTypes: {
    typeA: { name: string; count: number; desired: number };
    typeB: { name: string; count: number; desired: number };
    typeC: { name: string; count: number; desired: number };
  };
  penaltyPercentage: number;
  results: {
    keepableHandProbability: number;
    averageTypeA: number;
    averageTypeB: number;
    averageTypeC: number;
    expectedMulligans: number;
  };
}

const stores = [
  { name: "401 Games", urlPattern: "https://store.401games.ca/pages/search-results?q=<CARD_NAME>" },
  { name: "The CG Realm", urlPattern: "https://www.thecgrealm.com/search?q=*<CARD_NAME>*" },
  { name: "Imaginaire", urlPattern: "https://imaginaire.com/en/magic/advanced-search/results.html?q=<CARD_NAME>" },
  { name: "Hobbiesville", urlPattern: "https://hobbiesville.com/search?q=<CARD_NAME>" },
];

const MAX_CONCURRENT_TABS = 15;

// --- Card Data Loading ---
// Fetch the large JSON file from the public directory and index it by card name
let cardDataPromise: Promise<any[]> | null = null;
let cardByName: Map<string, any> | null = null;

export async function loadCardData() {
  if (!cardDataPromise) {
    cardDataPromise = fetch('/oracle-cards-20250711210505.json').then(res => res.json());
  }
  const data = await cardDataPromise;
  if (!cardByName) {
    cardByName = new Map(data.map((card: any) => [card.name, card]));
  }
  return { data, cardByName };
}

// --- Hypergeometric Probability Function ---
/**
 * Calculates the probability of drawing at least k successes in n draws from a population of size N with K successes.
 * Formula: P(X >= k) = sum_{i=k}^min(n,K) [C(K,i) * C(N-K, n-i)] / C(N, n)
 * Where C(a, b) is the binomial coefficient (a choose b).
 *
 * @param N Total population size (deck size)
 * @param K Number of successes in population (e.g., number of lands)
 * @param n Number of draws (cards seen)
 * @param k Minimum number of successes desired (e.g., lands in hand)
 * @returns Probability (0-1)
 */
export function hypergeometricAtLeast(N: number, K: number, n: number, k: number): number {
  function binom(a: number, b: number): number {
    if (b < 0 || b > a) return 0;
    if (b === 0 || b === a) return 1;
    let res = 1;
    for (let i = 1; i <= b; i++) {
      res *= (a - (b - i));
      res /= i;
    }
    return res;
  }
  let prob = 0;
  for (let i = k; i <= Math.min(n, K); i++) {
    prob += binom(K, i) * binom(N - K, n - i) / binom(N, n);
  }
  return prob;
}

export default function HomePage() {
  const [decklistText, setDecklistText] = useState<string>('');
  const [parsedCards, setParsedCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarSection, setSidebarSection] = useState<'cardlist' | 'search' | 'advancedsearch' | 'statistics' | 'simulator' | 'manabase' | 'oncurve' | 'twocard' | 'stormcount' | 'combos' | 'cardtype' | 'mulligan'>('cardlist');
  const [deckAnalysis, setDeckAnalysis] = useState<DeckAnalysis | null>(null);
  const [isAnalyzingDeck, setIsAnalyzingDeck] = useState<boolean>(false);
  const [onCurveAnalysis, setOnCurveAnalysis] = useState<OnCurveAnalysis | null>(null);
  const [isCalculatingOnCurve, setIsCalculatingOnCurve] = useState<boolean>(false);
  const [onCurveInputs, setOnCurveInputs] = useState({
    turn: 2,
    targetCMC: 2,
    playDraw: 'play' as 'play' | 'draw'
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedSearchResult, setSelectedSearchResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
  const [deckStatistics, setDeckStatistics] = useState<DeckStatistics | null>(null);
  const [isAnalyzingStatistics, setIsAnalyzingStatistics] = useState<boolean>(false);
  const [simulatedHand, setSimulatedHand] = useState<SimulatedHand | null>(null);
  const [twoCardComboAnalysis, setTwoCardComboAnalysis] = useState<TwoCardComboAnalysis | null>(null);
  const [isCalculatingTwoCard, setIsCalculatingTwoCard] = useState<boolean>(false);
  const [twoCardInputs, setTwoCardInputs] = useState({
    cardA: '',
    cardB: '',
    cardsDrawn: 7
  });
  const [stormCountAnalysis, setStormCountAnalysis] = useState<StormCountAnalysis | null>(null);
  const [isAnalyzingStorm, setIsAnalyzingStorm] = useState<boolean>(false);
  const [multiCriteriaSearch, setMultiCriteriaSearch] = useState<MultiCriteriaSearch>({
    cardName: '',
    cardType: '',
    colorIdentity: '',
    keywords: '',
    power: '',
    toughness: '',
    cmc: '',
    setCode: ''
  });
  const [advancedSearchResults, setAdvancedSearchResults] = useState<AdvancedSearchResult[]>([]);
  const [isAdvancedSearching, setIsAdvancedSearching] = useState<boolean>(false);
  const [showGalleryView, setShowGalleryView] = useState<boolean>(false);
  const [hoveredCard, setHoveredCard] = useState<CardDetails | null>(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [comboDetectionAnalysis, setComboDetectionAnalysis] = useState<ComboDetectionAnalysis | null>(null);
  const [isDetectingCombos, setIsDetectingCombos] = useState<boolean>(false);
  const [cardTypeDrawnAnalysis, setCardTypeDrawnAnalysis] = useState<CardTypeDrawnAnalysis | null>(null);
  const [isCalculatingCardType, setIsCalculatingCardType] = useState<boolean>(false);
  const [cardTypeInputs, setCardTypeInputs] = useState({
    deckSize: 60,
    cardTypeCount: 0,
    desiredCount: 1,
    targetTurn: 1,
    playDraw: 'play' as 'play' | 'draw'
  });
  const [mulliganStrategyAnalysis, setMulliganStrategyAnalysis] = useState<MulliganStrategyAnalysis | null>(null);
  const [isCalculatingMulligan, setIsCalculatingMulligan] = useState<boolean>(false);
  const [mulliganInputs, setMulliganInputs] = useState({
    deckSize: 60,
    freeMulligan: true,
    typeA: { name: 'Lands', count: 0, desired: 2 },
    typeB: { name: 'Ramp', count: 0, desired: 1 },
    typeC: { name: 'Interaction', count: 0, desired: 1 },
    penaltyPercentage: 20
  });

  // --- LocalStorage Persistence ---
  useEffect(() => {
    const savedDecklist = localStorage.getItem('mtgDecklist');
    if (savedDecklist) {
      setDecklistText(savedDecklist);
      // Optionally, parse it on load if you want to restore the list view
      // parseDecklist(savedDecklist); // Be careful with calling parse directly here
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mtgDecklist', decklistText);
    }
  }, [decklistText]);

  // --- Mana Base Analysis Functions ---
  const parseManaCost = (manaCost: string): ManaPips => {
    const pips: ManaPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, total: 0 };
    if (!manaCost) return pips;
    
    // Parse mana cost like "{1}{W}{U}" or "{2}{R}{R}"
    const matches = manaCost.match(/\{([^}]+)\}/g);
    if (matches) {
      matches.forEach(match => {
        const symbol = match.slice(1, -1); // Remove { and }
        if (symbol === 'W') pips.W++;
        else if (symbol === 'U') pips.U++;
        else if (symbol === 'B') pips.B++;
        else if (symbol === 'R') pips.R++;
        else if (symbol === 'G') pips.G++;
        else if (symbol === 'C') pips.C++;
        else if (!isNaN(Number(symbol))) {
          // Generic mana like {1}, {2}, etc.
          pips.C += Number(symbol);
        }
        pips.total++;
      });
    }
    return pips;
  };

  const analyzeDeck = async (decklist: string) => {
    setIsAnalyzingDeck(true);
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const cardCounts = new Map<string, number>();
      const cardDetails: Card[] = [];

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardCounts.set(name, (cardCounts.get(name) || 0) + quantity);
        }
      });

      let totalPips: ManaPips = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, total: 0 };
      let totalCMC = 0;
      let totalNonLandCards = 0;

      for (const [cardName, quantity] of cardCounts) {
        const cardData = cardByName.get(cardName);
        if (cardData) {
          const isLand = cardData.type_line?.toLowerCase().includes('land') || false;
          if (!isLand) {
            const manaCost = cardData.mana_cost || '';
            const cmc = cardData.cmc || 0;
            const pips = parseManaCost(manaCost);
            
            // Multiply by quantity
            totalPips.W += pips.W * quantity;
            totalPips.U += pips.U * quantity;
            totalPips.B += pips.B * quantity;
            totalPips.R += pips.R * quantity;
            totalPips.G += pips.G * quantity;
            totalPips.C += pips.C * quantity;
            totalPips.total += pips.total * quantity;
            
            totalCMC += cmc * quantity;
            totalNonLandCards += quantity;
          }
        }
      }

      const totalCards = Array.from(cardCounts.values()).reduce((sum, count) => sum + count, 0);
      const landCards = totalCards - totalNonLandCards;
      const averageCMC = totalNonLandCards > 0 ? totalCMC / totalNonLandCards : 0;

      // Calculate land drop probabilities for turns 2-5
      const landDropProbs = [];
      for (let turn = 2; turn <= 5; turn++) {
        const cardsDrawn = 7 + (turn - 1); // 7 starting hand + draws
        const probability = hypergeometricAtLeast(totalCards, landCards, cardsDrawn, turn);
        landDropProbs.push({ turn, probability });
      }

      const analysis: DeckAnalysis = {
        totalCards,
        nonLandCards: totalNonLandCards,
        landCards,
        manaPips: totalPips,
        averageCMC,
        landDropProbabilities: landDropProbs
      };

      setDeckAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing deck:', error);
    } finally {
      setIsAnalyzingDeck(false);
    }
  };

  // --- On Curve Analysis Functions ---
  const calculateOnCurveProbability = async (decklist: string, turn: number, targetCMC: number, playDraw: 'play' | 'draw') => {
    setIsCalculatingOnCurve(true);
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const cardCounts = new Map<string, number>();

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardCounts.set(name, (cardCounts.get(name) || 0) + quantity);
        }
      });

      let totalCards = 0;
      let landCards = 0;
      let targetSpellCards = 0;

      for (const [cardName, quantity] of cardCounts) {
        const cardData = cardByName.get(cardName);
        if (cardData) {
          totalCards += quantity;
          const isLand = cardData.type_line?.toLowerCase().includes('land') || false;
          if (isLand) {
            landCards += quantity;
          } else {
            const cmc = cardData.cmc || 0;
            if (cmc === targetCMC) {
              targetSpellCards += quantity;
            }
          }
        }
      }

      const cardsDrawn = playDraw === 'play' ? 7 + (turn - 1) : 7 + turn;
      const landsNeeded = targetCMC;

      // Calculate probability of having enough lands
      const landProbability = hypergeometricAtLeast(totalCards, landCards, cardsDrawn, landsNeeded);
      
      // Calculate probability of having at least one spell of target CMC
      const spellProbability = hypergeometricAtLeast(totalCards, targetSpellCards, cardsDrawn, 1);
      
      // Combined probability (simplified: multiply probabilities)
      const combinedProbability = landProbability * spellProbability;

      const analysis: OnCurveAnalysis = {
        turn,
        targetCMC,
        playDraw,
        cardsDrawn,
        landProbability,
        spellProbability,
        combinedProbability,
        calculationDetails: {
          landCalc: { N: totalCards, K: landCards, n: cardsDrawn, k: landsNeeded },
          spellCalc: { N: totalCards, K: targetSpellCards, n: cardsDrawn, k: 1 }
        }
      };

      setOnCurveAnalysis(analysis);
    } catch (error) {
      console.error('Error calculating on-curve probability:', error);
    } finally {
      setIsCalculatingOnCurve(false);
    }
  };

  // --- Deck Statistics Functions ---
  const analyzeDeckStatistics = async (decklist: string) => {
    setIsAnalyzingStatistics(true);
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const cardCounts = new Map<string, number>();

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardCounts.set(name, (cardCounts.get(name) || 0) + quantity);
        }
      });

      const totalCards = Array.from(cardCounts.values()).reduce((sum, count) => sum + count, 0);
      
      // Mana Curve Analysis
      const manaCurveMap = new Map<number, number>();
      let totalCMC = 0;
      let nonLandCount = 0;

      // Color Distribution
      const colorCounts = new Map<string, number>();
      const cardTypeCounts = new Map<string, number>();

      for (const [cardName, quantity] of cardCounts) {
        const cardData = cardByName.get(cardName);
        if (cardData) {
          const isLand = cardData.type_line?.toLowerCase().includes('land') || false;
          
          if (!isLand) {
            const cmc = cardData.cmc || 0;
            manaCurveMap.set(cmc, (manaCurveMap.get(cmc) || 0) + quantity);
            totalCMC += cmc * quantity;
            nonLandCount += quantity;

            // Color analysis
            const manaCost = cardData.mana_cost || '';
            const colors = new Set<string>();
                         const matches = manaCost.match(/\{([^}]+)\}/g);
             if (matches) {
               matches.forEach((match: string) => {
                 const symbol = match.slice(1, -1);
                 if (symbol === 'W') colors.add('White');
                 else if (symbol === 'U') colors.add('Blue');
                 else if (symbol === 'B') colors.add('Black');
                 else if (symbol === 'R') colors.add('Red');
                 else if (symbol === 'G') colors.add('Green');
                 else if (symbol === 'C') colors.add('Colorless');
               });
             }
            if (colors.size === 0) colors.add('Colorless');
            
            colors.forEach(color => {
              colorCounts.set(color, (colorCounts.get(color) || 0) + quantity);
            });
          }

                     // Card type analysis
           const typeLine = cardData.type_line || '';
           const types = typeLine.split('—')[0].trim().split(' ');
           types.forEach((type: string) => {
             if (type && type !== 'Legendary' && type !== 'Basic') {
               cardTypeCounts.set(type, (cardTypeCounts.get(type) || 0) + quantity);
             }
           });
        }
      }

      const averageMV = nonLandCount > 0 ? totalCMC / nonLandCount : 0;
      
      // Convert maps to arrays
      const manaCurve = Array.from(manaCurveMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([cmc, count]) => ({ cmc, count }));

      const colorDistribution = Array.from(colorCounts.entries())
        .map(([color, count]) => ({ 
          color, 
          count, 
          percentage: Math.round((count / totalCards) * 100) 
        }))
        .sort((a, b) => b.count - a.count);

      const cardTypeBreakdown = Array.from(cardTypeCounts.entries())
        .map(([type, count]) => ({ 
          type, 
          count, 
          percentage: Math.round((count / totalCards) * 100) 
        }))
        .sort((a, b) => b.count - a.count);

      // Commander analysis (simplified)
      let commanderInfo = undefined;
      const commanderCards = Array.from(cardCounts.entries())
        .filter(([name, count]) => {
          const cardData = cardByName.get(name);
          return cardData?.type_line?.toLowerCase().includes('legendary') && 
                 cardData?.type_line?.toLowerCase().includes('creature');
        });

      if (commanderCards.length > 0) {
        const commander = commanderCards[0];
        const cardData = cardByName.get(commander[0]);
        if (cardData) {
                     const manaCost = cardData.mana_cost || '';
           const colorIdentity = new Set<string>();
           const matches = manaCost.match(/\{([^}]+)\}/g);
           if (matches) {
             matches.forEach((match: string) => {
               const symbol = match.slice(1, -1);
               if (symbol === 'W') colorIdentity.add('W');
               else if (symbol === 'U') colorIdentity.add('U');
               else if (symbol === 'B') colorIdentity.add('B');
               else if (symbol === 'R') colorIdentity.add('R');
               else if (symbol === 'G') colorIdentity.add('G');
             });
           }
          
          commanderInfo = {
            name: commander[0],
            colorIdentity: Array.from(colorIdentity),
            illegalCards: [] // Simplified - would need more complex logic
          };
        }
      }

      // Format legality (simplified)
      const formatLegality = [
        { format: 'Standard', legal: true, illegalCards: [] },
        { format: 'Modern', legal: true, illegalCards: [] },
        { format: 'Commander', legal: true, illegalCards: [] }
      ];

      const statistics: DeckStatistics = {
        manaCurve,
        colorDistribution,
        cardTypeBreakdown,
        averageMV,
        commanderInfo,
        formatLegality
      };

      setDeckStatistics(statistics);
    } catch (error) {
      console.error('Error analyzing deck statistics:', error);
    } finally {
      setIsAnalyzingStatistics(false);
    }
  };

  // --- Hand Simulator Functions ---
  const simulateOpeningHand = async (decklist: string) => {
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const deck: Array<{ name: string; quantity: number }> = [];

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          for (let i = 0; i < quantity; i++) {
            deck.push({ name, quantity: 1 });
          }
        }
      });

      // Shuffle deck
      const shuffledDeck = [...deck].sort(() => Math.random() - 0.5);
      
      // Draw 7 cards
      const handCards = shuffledDeck.slice(0, 7);
      
      // Get card details
      const handWithDetails = await Promise.all(
        handCards.map(async (card) => {
          const cardData = cardByName.get(card.name);
          return {
            name: card.name,
            imageUrl: cardData?.image_uris?.normal,
            manaCost: cardData?.mana_cost,
            typeLine: cardData?.type_line,
            cmc: cardData?.cmc
          };
        })
      );

      setSimulatedHand({ cards: handWithDetails });
    } catch (error) {
      console.error('Error simulating opening hand:', error);
    }
  };

  const generateSearchUrl = (pattern: string, cardName: string): string => {
    return pattern.replace("<CARD_NAME>", encodeURIComponent(cardName));
  };

  const fetchCardImageAndUpdateState = async (cardName: string, cardsArray: Card[]): Promise<Card[]> => {
    try {
      // Scryfall API recommends a 50-100ms delay between requests
      await new Promise(resolve => setTimeout(resolve, 75));

      const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(cardName)}`);
      let data: ScryfallCard;

      if (!response.ok) {
        const exactResponse = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
        if (!exactResponse.ok) {
          console.error(`Scryfall API error for ${cardName}: ${exactResponse.statusText}`);
          return cardsArray.map(c => c.name === cardName ? { ...c, isLoadingImage: false, imageError: true } : c);
        }
        data = await exactResponse.json();
      } else {
        data = await response.json();
      }
      
      const imageUrl = data.image_uris?.normal || data.image_uris?.small || (data.card_faces && data.card_faces[0]?.image_uris?.normal) || null;
      return cardsArray.map(c => c.name === cardName ? { ...c, imageUrl, isLoadingImage: false } : c);

    } catch (error) {
      console.error(`Failed to fetch card image for ${cardName}:`, error);
      return cardsArray.map(c => c.name === cardName ? { ...c, isLoadingImage: false, imageError: true } : c);
    }
  };

  const parseDecklistAndFetchImages = async (currentDecklist: string) => {
    setIsLoading(true);
    setSelectedCard(null); // Clear selected card on new parse

    const lines = currentDecklist.split('\n');
    const uniqueCardNames = new Set<string>();

    lines.forEach(line => {
      let name = line.trim();

      // 1. Remove comments starting with //
      name = name.replace(/\s*\/\/.*$/, '');

      // 2. Remove quantity prefix (e.g., "4x ", "1 ", "1x ")
      name = name.replace(/^\s*\d+\s*x?\s*/, '');

      // 3. Remove set code and collector number information from the end of the card name.
      //    Matches patterns like " (SET)number", " (SET)", " (SET) Foil", " (SET) Promo [Extended Art]"
      name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();

      if (name) {
        uniqueCardNames.add(name);
      }
    });

    let initialProcessedCards: Card[] = Array.from(uniqueCardNames).map(name => ({
      name,
      searchUrls: stores.map(store => ({
        storeName: store.name,
        url: generateSearchUrl(store.urlPattern, name),
      })),
      isLoadingImage: true,
      imageError: false,
    }));
    
    setParsedCards(initialProcessedCards); // Show names in the list immediately

    // Sequentially fetch images to update the list
    // This updates the main parsedCards list, which the selected card will also reference
    for (let i = 0; i < initialProcessedCards.length; i++) {
        const cardToFetch = initialProcessedCards[i];
        initialProcessedCards = await fetchCardImageAndUpdateState(cardToFetch.name, initialProcessedCards);
        setParsedCards([...initialProcessedCards]); // Update state progressively

        // If this is the currently selected card, update its details too
        if (selectedCard && selectedCard.name === cardToFetch.name) {
            const updatedCardData = initialProcessedCards.find(c => c.name === cardToFetch.name);
            if (updatedCardData) setSelectedCard(updatedCardData);
        }
         // Auto-select the first card after its image is processed (or attempted)
        if (i === 0) {
            const firstCardData = initialProcessedCards.find(c => c.name === cardToFetch.name);
            if (firstCardData) setSelectedCard(firstCardData);
        }
    }
    setIsLoading(false);
  };

  // --- Single Card Search Functions ---
  const searchCards = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowAutocomplete(false);
      return;
    }

    setIsSearching(true);
    try {
      // Use the search endpoint instead of autocomplete for better results
      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=cards`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data.slice(0, 10)); // Limit to 10 results
        setShowAutocomplete(true);
      } else {
        setSearchResults([]);
        setShowAutocomplete(false);
      }
    } catch (error) {
      console.error('Error searching cards:', error);
      setSearchResults([]);
      setShowAutocomplete(false);
    } finally {
      setIsSearching(false);
    }
  };

  const selectCard = async (cardName: string) => {
    setIsSearching(true);
    try {
      // First try local lookup
      const { cardByName } = await loadCardData();
      let cardData = cardByName.get(cardName);
      
      if (!cardData) {
        // API fallback for missing cards
        const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
        if (response.ok) {
          cardData = await response.json();
        } else {
          console.error(`Card not found: ${cardName}`);
          return;
        }
      }

      const searchResult: SearchResult = {
        name: cardData.name,
        id: cardData.id,
        image_uris: cardData.image_uris,
        mana_cost: cardData.mana_cost,
        type_line: cardData.type_line,
        oracle_text: cardData.oracle_text,
        cmc: cardData.cmc
      };

      setSelectedSearchResult(searchResult);
      setSearchQuery(cardName);
      setShowAutocomplete(false);
    } catch (error) {
      console.error('Error selecting card:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (query.length >= 2) {
      searchCards(query);
    } else {
      setSearchResults([]);
      setShowAutocomplete(false);
    }
  };

  const handleDecklistChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDecklistText(event.target.value);
  };

  // --- Two-Card Combo Probability Functions ---
  const calculateTwoCardComboProbability = async (decklist: string, cardA: string, cardB: string, cardsDrawn: number) => {
    setIsCalculatingTwoCard(true);
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const cardCounts = new Map<string, number>();

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardCounts.set(name, (cardCounts.get(name) || 0) + quantity);
        }
      });

      const totalCards = Array.from(cardCounts.values()).reduce((sum, count) => sum + count, 0);
      const countA = cardCounts.get(cardA) || 0;
      const countB = cardCounts.get(cardB) || 0;

      if (countA === 0 || countB === 0) {
        throw new Error(`Card not found in deck: ${countA === 0 ? cardA : cardB}`);
      }

      // Using inclusion-exclusion principle: P(A and B) = 1 - P(A missing OR B missing)
      // P(A missing OR B missing) = P(A missing) + P(B missing) - P(A missing AND B missing)
      
             // P(A missing) = C(N-KA, n) / C(N, n)
       const probAMissing = 1 - hypergeometricAtLeast(totalCards, countA, cardsDrawn, 1);
       
       // P(B missing) = C(N-KB, n) / C(N, n)
       const probBMissing = 1 - hypergeometricAtLeast(totalCards, countB, cardsDrawn, 1);
       
       // P(A missing AND B missing) = C(N-KA-KB, n) / C(N, n)
       const probBothMissing = 1 - hypergeometricAtLeast(totalCards, countA + countB, cardsDrawn, 1);
      
      // P(A missing OR B missing) = P(A missing) + P(B missing) - P(A missing AND B missing)
      const probEitherMissing = probAMissing + probBMissing - probBothMissing;
      
      // P(A and B) = 1 - P(A missing OR B missing)
      const probability = 1 - probEitherMissing;

      const analysis: TwoCardComboAnalysis = {
        cardA,
        cardB,
        cardsDrawn,
        probability,
        calculationDetails: {
          N: totalCards,
          KA: countA,
          KB: countB,
          n: cardsDrawn
        }
      };

      setTwoCardComboAnalysis(analysis);
    } catch (error) {
      console.error('Error calculating two-card combo probability:', error);
    } finally {
      setIsCalculatingTwoCard(false);
    }
  };

  // --- Storm Count Analysis Functions ---
  const analyzeStormCount = async (decklist: string) => {
    setIsAnalyzingStorm(true);
    try {
      const { cardByName } = await loadCardData();
      
      const lines = decklist.split('\n');
      const cardCounts = new Map<string, number>();

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        const quantityMatch = name.match(/^(\d+)\s*x?\s*/);
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardCounts.set(name, (cardCounts.get(name) || 0) + quantity);
        }
      });

      let totalSpells = 0;
      let stormSpells = 0;
      let cantripSpells = 0;
      let lowCostSpells = 0;
      
      const stormCards: string[] = [];
      const cantripCards: string[] = [];
      const lowCostCards: string[] = [];

      for (const [cardName, quantity] of cardCounts) {
        const cardData = cardByName.get(cardName);
        if (cardData) {
          const isLand = cardData.type_line?.toLowerCase().includes('land') || false;
          const isInstant = cardData.type_line?.toLowerCase().includes('instant') || false;
          const isSorcery = cardData.type_line?.toLowerCase().includes('sorcery') || false;
          
          if (!isLand && (isInstant || isSorcery)) {
            totalSpells += quantity;
            
            // Check for Storm keyword
            const oracleText = cardData.oracle_text?.toLowerCase() || '';
            if (oracleText.includes('storm')) {
              stormSpells += quantity;
              stormCards.push(cardName);
            }
            
            // Check for cantrip effects (draw a card)
            if (oracleText.includes('draw a card') || oracleText.includes('draw 1 card')) {
              cantripSpells += quantity;
              cantripCards.push(cardName);
            }
            
            // Check for low-cost spells (CMC 1-2)
            const cmc = cardData.cmc || 0;
            if (cmc <= 2) {
              lowCostSpells += quantity;
              lowCostCards.push(cardName);
            }
          }
        }
      }

      const analysis: StormCountAnalysis = {
        totalSpells,
        stormSpells,
        cantripSpells,
        lowCostSpells,
        breakdown: {
          storm: stormCards,
          cantrips: cantripCards,
          lowCost: lowCostCards
        }
      };

      setStormCountAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing storm count:', error);
    } finally {
      setIsAnalyzingStorm(false);
    }
  };

  // --- Advanced Search Functions ---
  const performAdvancedSearch = async (criteria: MultiCriteriaSearch) => {
    setIsAdvancedSearching(true);
    try {
      let query = '';
      
      if (criteria.cardName) query += `name:"${criteria.cardName}" `;
      if (criteria.cardType) query += `t:${criteria.cardType.toLowerCase()} `;
      if (criteria.colorIdentity) {
        const colors = criteria.colorIdentity.toLowerCase().split('/');
        colors.forEach(color => {
          if (color === 'red') query += 'c:r ';
          else if (color === 'blue') query += 'c:u ';
          else if (color === 'green') query += 'c:g ';
          else if (color === 'white') query += 'c:w ';
          else if (color === 'black') query += 'c:b ';
          else if (color === 'colorless') query += 'c:c ';
        });
      }
      if (criteria.keywords) query += `oracle:"${criteria.keywords}" `;
      if (criteria.power) query += `pow:${criteria.power} `;
      if (criteria.toughness) query += `tou:${criteria.toughness} `;
      if (criteria.cmc) query += `cmc:${criteria.cmc} `;
      if (criteria.setCode) query += `s:${criteria.setCode.toLowerCase()} `;
      
      if (!query.trim()) {
        throw new Error('Please provide at least one search criteria');
      }

      const response = await fetch(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();
      setAdvancedSearchResults(data.data || []);
    } catch (error) {
      console.error('Error performing advanced search:', error);
      setAdvancedSearchResults([]);
    } finally {
      setIsAdvancedSearching(false);
    }
  };

  // --- Card Details Functions ---
  const getCardDetails = async (cardName: string): Promise<CardDetails | null> => {
    try {
      const { cardByName } = await loadCardData();
      const cardData = cardByName.get(cardName);
      
      if (cardData) {
        return {
          name: cardData.name,
          oracle_text: cardData.oracle_text,
          flavor_text: cardData.flavor_text,
          artist: cardData.artist,
          collector_number: cardData.collector_number,
          set_name: cardData.set_name,
          legalities: cardData.legalities,
          image_uris: cardData.image_uris
        };
      }
      
      // Fallback to API
      const response = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(cardName)}`);
      if (response.ok) {
        const cardData = await response.json();
        return {
          name: cardData.name,
          oracle_text: cardData.oracle_text,
          flavor_text: cardData.flavor_text,
          artist: cardData.artist,
          collector_number: cardData.collector_number,
          set_name: cardData.set_name,
          legalities: cardData.legalities,
          image_uris: cardData.image_uris
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting card details:', error);
      return null;
    }
  };

  const handleCardHover = async (cardName: string, event: React.MouseEvent) => {
    const details = await getCardDetails(cardName);
    if (details) {
      setHoveredCard(details);
      setHoverPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleCardLeave = () => {
    setHoveredCard(null);
  };

  // --- External Links Functions ---
  const getExternalLinks = (cardName: string) => {
    const encodedName = encodeURIComponent(cardName);
    const edhrecName = cardName.toLowerCase().replace(/\s+/g, '-');
    return {
      edhrec: `https://edhrec.com/cards/${edhrecName}`,
      gatherer: `https://gatherer.wizards.com/Pages/Card/Details.aspx?name=${encodedName}`
    };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sidebarSection === 'cardlist') {
      parseDecklistAndFetchImages(decklistText);
    } else if (sidebarSection === 'manabase') {
      analyzeDeck(decklistText);
    } else if (sidebarSection === 'oncurve') {
      calculateOnCurveProbability(decklistText, onCurveInputs.turn, onCurveInputs.targetCMC, onCurveInputs.playDraw);
    } else if (sidebarSection === 'statistics') {
      analyzeDeckStatistics(decklistText);
    } else if (sidebarSection === 'simulator') {
      simulateOpeningHand(decklistText);
    } else if (sidebarSection === 'twocard') {
      if (twoCardInputs.cardA && twoCardInputs.cardB && decklistText.trim()) {
        calculateTwoCardComboProbability(decklistText, twoCardInputs.cardA, twoCardInputs.cardB, twoCardInputs.cardsDrawn);
      }
    } else if (sidebarSection === 'stormcount') {
      analyzeStormCount(decklistText);
    } else if (sidebarSection === 'advancedsearch') {
      performAdvancedSearch(multiCriteriaSearch);
    } else if (sidebarSection === 'combos') {
      detectCombos(decklistText);
    } else if (sidebarSection === 'cardtype') {
      calculateCardTypeDrawnProbability(cardTypeInputs.deckSize, cardTypeInputs.cardTypeCount, cardTypeInputs.desiredCount, cardTypeInputs.targetTurn, cardTypeInputs.playDraw);
    } else if (sidebarSection === 'mulligan') {
      calculateMulliganStrategy(mulliganInputs);
    }
  };

  const handleSelectCard = (cardName: string) => {
    const card = parsedCards.find(c => c.name === cardName);
    if (card) {
      setSelectedCard(card);
    }
  };

  // --- Tab Opening Functions ---
  const openAllStoresForSelectedCard = () => {
    if (!selectedCard) return;
    selectedCard.searchUrls.forEach(storeSearch => {
      window.open(storeSearch.url, '_blank', 'noopener,noreferrer');
    });
  };

  const openAllStoresForAllCards = () => {
    const totalTabsToOpen = parsedCards.reduce((acc, card) => acc + card.searchUrls.length, 0);
    if (totalTabsToOpen > MAX_CONCURRENT_TABS) {
      if (!window.confirm(`This will open ${totalTabsToOpen} tabs, which might affect your browser's performance. Are you sure you want to proceed?`)) {
        return;
      }
    }
    parsedCards.forEach(card => {
      card.searchUrls.forEach(storeSearch => {
        window.open(storeSearch.url, '_blank', 'noopener,noreferrer');
      });
    });
  };

  // --- Combo Detection Functions ---
  const detectCombos = async (decklist: string) => {
    setIsDetectingCombos(true);
    try {
      // Parse decklist to extract unique card names
      const lines = decklist.split('\n');
      const cardNames = new Set<string>();

      lines.forEach(line => {
        let name = line.trim();
        name = name.replace(/\s*\/\/.*$/, '');
        name = name.replace(/^\s*\d+\s*x?\s*/, '');
        name = name.replace(/\s+\([A-Za-z0-9]{3,5}\)([\w\s\d\.\-\[\]\*\']*)?$/, "").trim();
        
        if (name) {
          cardNames.add(name);
        }
      });

      const uniqueCardNames = Array.from(cardNames);
      
      if (uniqueCardNames.length === 0) {
        throw new Error('No valid cards found in decklist');
      }

      // Call Commander Spellbook API
      const response = await fetch('https://backend.commanderspellbook.com/find-my-combos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cards: uniqueCardNames
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const combos = data.combos || [];

      // Process combos to mark which cards are in the deck
      const processedCombos: Combo[] = combos.map((combo: any) => ({
        id: combo.id,
        name: combo.name,
        cards: combo.cards.map((card: any) => ({
          name: card.name,
          inDeck: uniqueCardNames.includes(card.name)
        })),
        results: combo.results.map((result: any) => ({
          name: result.name,
          inDeck: false // Results are not cards in the deck
        })),
        color_identity: combo.color_identity,
        prerequisites: combo.prerequisites,
        steps: combo.steps
      }));

      const analysis: ComboDetectionAnalysis = {
        combos: processedCombos,
        totalCombos: processedCombos.length,
        deckCards: uniqueCardNames
      };

      setComboDetectionAnalysis(analysis);
    } catch (error) {
      console.error('Error detecting combos:', error);
      setComboDetectionAnalysis(null);
    } finally {
      setIsDetectingCombos(false);
    }
  };

  // --- Card Type Drawn Probability Functions ---
  const calculateCardTypeDrawnProbability = async (deckSize: number, cardTypeCount: number, desiredCount: number, targetTurn: number, playDraw: 'play' | 'draw') => {
    setIsCalculatingCardType(true);
    try {
      // Calculate cards drawn based on turn and play/draw status
      let cardsDrawn = 7; // Opening hand
      if (targetTurn > 1) {
        cardsDrawn += (targetTurn - 1); // Draw for turn
        if (playDraw === 'draw') {
          cardsDrawn += 1; // Extra card on draw
        }
      }

      // Calculate probability using hypergeometric distribution
      const probability = hypergeometricAtLeast(deckSize, cardTypeCount, cardsDrawn, desiredCount);

      const analysis: CardTypeDrawnAnalysis = {
        deckSize,
        cardTypeCount,
        desiredCount,
        targetTurn,
        cardsDrawn,
        probability,
        calculationDetails: {
          N: deckSize,
          K: cardTypeCount,
          n: cardsDrawn,
          k: desiredCount
        }
      };

      setCardTypeDrawnAnalysis(analysis);
    } catch (error) {
      console.error('Error calculating card type drawn probability:', error);
    } finally {
      setIsCalculatingCardType(false);
    }
  };

  // --- Mulligan Strategy Functions ---
  const calculateMulliganStrategy = async (inputs: typeof mulliganInputs) => {
    setIsCalculatingMulligan(true);
    try {
      const { deckSize, freeMulligan, typeA, typeB, typeC, penaltyPercentage } = inputs;
      
      // Calculate probabilities for each mulligan step
      let keepableHandProbability = 0;
      let expectedMulligans = 0;
      let totalProbability = 0;
      
      // For simplicity, we'll calculate for up to 3 mulligans
      for (let mulligans = 0; mulligans <= 3; mulligans++) {
        let handSize = 7 - mulligans;
        if (!freeMulligan && mulligans > 0) {
          // Apply penalty for non-free mulligans
          const penalty = Math.floor(handSize * (penaltyPercentage / 100));
          handSize -= penalty;
        }
        
        // Calculate probability of having desired cards in this hand
        const probA = hypergeometricAtLeast(deckSize, typeA.count, handSize, typeA.desired);
        const probB = hypergeometricAtLeast(deckSize, typeB.count, handSize, typeB.desired);
        const probC = hypergeometricAtLeast(deckSize, typeC.count, handSize, typeC.desired);
        
        // Combined probability (simplified - assumes independence)
        const combinedProb = probA * probB * probC;
        
        if (combinedProb >= 0.5) { // Consider 50%+ as keepable
          keepableHandProbability += combinedProb;
          expectedMulligans += mulligans * combinedProb;
          totalProbability += combinedProb;
        }
      }
      
      // Calculate average cards of each type in opening hand
      const averageTypeA = (7 * typeA.count) / deckSize;
      const averageTypeB = (7 * typeB.count) / deckSize;
      const averageTypeC = (7 * typeC.count) / deckSize;
      
      const analysis: MulliganStrategyAnalysis = {
        deckSize,
        freeMulligan,
        cardTypes: { typeA, typeB, typeC },
        penaltyPercentage,
        results: {
          keepableHandProbability: keepableHandProbability,
          averageTypeA,
          averageTypeB,
          averageTypeC,
          expectedMulligans: expectedMulligans / totalProbability || 0
        }
      };

      setMulliganStrategyAnalysis(analysis);
    } catch (error) {
      console.error('Error calculating mulligan strategy:', error);
    } finally {
      setIsCalculatingMulligan(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>MTG Card Searcher</h1>
        <p>Moxfield-inspired Layout</p>
      </header>
      <main className={styles.mainContent} style={{ flexDirection: 'row' }}>
        <nav className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Tools</div>
          <div className={styles.sidebarNav}>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'cardlist' ? styles.active : ''}`} onClick={() => setSidebarSection('cardlist')}>Card List</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'search' ? styles.active : ''}`} onClick={() => setSidebarSection('search')}>Card Search</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'advancedsearch' ? styles.active : ''}`} onClick={() => setSidebarSection('advancedsearch')}>Advanced Search</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'statistics' ? styles.active : ''}`} onClick={() => setSidebarSection('statistics')}>Statistics</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'simulator' ? styles.active : ''}`} onClick={() => setSidebarSection('simulator')}>Hand Sim</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'manabase' ? styles.active : ''}`} onClick={() => setSidebarSection('manabase')}>Mana Base</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'oncurve' ? styles.active : ''}`} onClick={() => setSidebarSection('oncurve')}>On Curve</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'twocard' ? styles.active : ''}`} onClick={() => setSidebarSection('twocard')}>Two Card</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'stormcount' ? styles.active : ''}`} onClick={() => setSidebarSection('stormcount')}>Storm Count</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'combos' ? styles.active : ''}`} onClick={() => setSidebarSection('combos')}>Combos</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'cardtype' ? styles.active : ''}`} onClick={() => setSidebarSection('cardtype')}>Card Type</button>
            <button className={`${styles.sidebarNavButton} ${sidebarSection === 'mulligan' ? styles.active : ''}`} onClick={() => setSidebarSection('mulligan')}>Mulligan</button>
          </div>
        </nav>
        <div style={{ flex: 1 }}>
          {sidebarSection === 'cardlist' && (
            <>
              <section className={styles.inputSection}>
                <h2>Enter Your Decklist</h2>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isLoading}>
                    {isLoading ? 'Processing...' : 'Parse Deck & Find Cards'}
                  </button>
                </form>
              </section>
              <section className={styles.resultsSection}>
                <div className={styles.leftPanel}>
                  {selectedCard ? (
                    <>
                      <h3 className={styles.selectedCardName}>{selectedCard.name}</h3>
                      {selectedCard.isLoadingImage && <p className={styles.imageStatus}>Loading image...</p>}
                      {selectedCard.imageError && <p className={styles.imageStatus}>Image not found or error.</p>}
                      {selectedCard.imageUrl && (
                        <div className={styles.imageContainer}>
                          <img src={selectedCard.imageUrl} alt={selectedCard.name} className={styles.cardImage} />
                        </div>
                      )}
                      {!selectedCard.isLoadingImage && !selectedCard.imageUrl && !selectedCard.imageError && (
                        <p className={styles.imageStatus}>No image available.</p>
                      )}
                      <div className={styles.buttonGroup}>
                        {selectedCard.searchUrls.map(storeSearch => (
                          <a
                            key={storeSearch.storeName}
                            href={storeSearch.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.button} ${styles.storeButton}`}
                          >
                            Search on {storeSearch.storeName}
                          </a>
                        ))}
                        <button
                          onClick={openAllStoresForSelectedCard}
                          className={`${styles.button} ${styles.openCardAllStoresButton}`}
                          title={`Open all ${selectedCard.searchUrls.length} store tabs for ${selectedCard.name}`}
                        >
                          Open All Stores for This Card
                        </button>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <h4 style={{ marginBottom: 8, color: '#00bcd4' }}>External Resources</h4>
                        <div className={styles.buttonGroup}>
                          {(() => {
                            const links = getExternalLinks(selectedCard.name);
                            return (
                              <>
                                <a
                                  href={links.edhrec}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${styles.button} ${styles.storeButton}`}
                                  style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                                >
                                  EDHREC
                                </a>

                                <a
                                  href={links.gatherer}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`${styles.button} ${styles.storeButton}`}
                                  style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                                >
                                  Gatherer
                                </a>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  ) :
                    <p className={styles.placeholderText}>Select a card from the list to see details.</p>
                  }
                </div>
                                  <div className={styles.rightPanel}>
                    <div className={styles.cardListHeader}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4>Card List ({parsedCards.length})</h4>
                        <button
                          onClick={() => setShowGalleryView(!showGalleryView)}
                          className={styles.button}
                          style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                        >
                          {showGalleryView ? 'List View' : 'Gallery View'}
                        </button>
                      </div>
                    </div>
                    {showGalleryView ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '12px',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}>
                        {parsedCards.map((card) => (
                          <div
                            key={card.name}
                            style={{
                              background: '#1a1a1a',
                              borderRadius: '8px',
                              padding: '8px',
                              border: '1px solid #444',
                              textAlign: 'center',
                              position: 'relative',
                              cursor: 'pointer'
                            }}
                            onClick={() => handleSelectCard(card.name)}
                            onMouseEnter={(e) => handleCardHover(card.name, e)}
                            onMouseLeave={handleCardLeave}
                          >
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl}
                                alt={card.name}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  borderRadius: '4px',
                                  marginBottom: '8px'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '120px',
                                background: '#333',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '8px',
                                color: '#888',
                                fontSize: '0.8rem'
                              }}>
                                {card.isLoadingImage ? 'Loading...' : card.imageError ? 'Error' : 'No Image'}
                              </div>
                            )}
                            <div style={{ fontSize: '0.8rem', color: '#e0e0e0' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ul className={styles.cardList} aria-label="Card list">
                        {parsedCards.map((card) => (
                          <li
                            key={card.name}
                            className={`${styles.cardListItem} ${selectedCard?.name === card.name ? styles.selectedListItem : ''}`}
                            onClick={() => handleSelectCard(card.name)}
                            onMouseEnter={(e) => handleCardHover(card.name, e)}
                            onMouseLeave={handleCardLeave}
                          >
                            {card.name}
                            {card.isLoadingImage && <span className={styles.listItemStatus}> (loading img...)</span>}
                            {card.imageError && <span className={styles.listItemStatusError}> (img err)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
              </section>
            </>
          )}
          {sidebarSection === 'search' && (
            <>
              <section className={styles.inputSection}>
                <h2>Single Card Search</h2>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search for a card..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '4px',
                      border: '1px solid #555',
                      background: '#333',
                      color: '#e0e0e0',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                  {isSearching && (
                    <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                      <span style={{ color: '#00bcd4' }}>Searching...</span>
                    </div>
                  )}
                  {showAutocomplete && searchResults.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}>
                      {searchResults.map((result) => (
                        <div
                          key={result.id}
                          onClick={() => selectCard(result.name)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #444',
                            color: '#e0e0e0'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#444'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          {result.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
              {selectedSearchResult && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3 className={styles.selectedCardName}>{selectedSearchResult.name}</h3>
                    {selectedSearchResult.image_uris?.normal && (
                      <div className={styles.imageContainer}>
                        <img src={selectedSearchResult.image_uris.normal} alt={selectedSearchResult.name} className={styles.cardImage} />
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <p><strong>Mana Cost:</strong> {selectedSearchResult.mana_cost || 'None'}</p>
                      <p><strong>Type:</strong> {selectedSearchResult.type_line || 'Unknown'}</p>
                      <p><strong>CMC:</strong> {selectedSearchResult.cmc || '0'}</p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Oracle Text</h3>
                    <div style={{
                      background: '#1a1a1a',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #444',
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      lineHeight: '1.4',
                      color: '#e0e0e0'
                    }}>
                      {selectedSearchResult.oracle_text || 'No oracle text available.'}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'statistics' && (
            <>
              <section className={styles.inputSection}>
                <h2>Deck Statistics Dashboard</h2>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isAnalyzingStatistics}>
                    {isAnalyzingStatistics ? 'Analyzing...' : 'Analyze Deck Statistics'}
                  </button>
                </form>
              </section>
              {deckStatistics && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Deck Overview</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Average MV:</strong> {deckStatistics.averageMV.toFixed(2)}</p>
                      {deckStatistics.commanderInfo && (
                        <div style={{ marginTop: 16 }}>
                          <p><strong>Commander:</strong> {deckStatistics.commanderInfo.name}</p>
                          <p><strong>Color Identity:</strong> {deckStatistics.commanderInfo.colorIdentity.join(', ') || 'Colorless'}</p>
                        </div>
                      )}
                    </div>
                    <h3>Mana Curve</h3>
                    <div style={{ marginBottom: 20 }}>
                      {deckStatistics.manaCurve.map(({ cmc, count }) => (
                        <div key={cmc} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span>CMC {cmc}:</span>
                            <span>{count} cards</span>
                          </div>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            background: '#444',
                            borderRadius: '4px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(count / Math.max(...deckStatistics.manaCurve.map(c => c.count))) * 100}%`,
                              height: '100%',
                              background: '#00bcd4',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Color Distribution</h3>
                    <div style={{ marginBottom: 20 }}>
                      {deckStatistics.colorDistribution.map(({ color, count, percentage }) => (
                        <div key={color} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{color}:</span>
                            <span>{count} ({percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <h3>Card Type Breakdown</h3>
                    <div style={{ marginBottom: 20 }}>
                      {deckStatistics.cardTypeBreakdown.map(({ type, count, percentage }) => (
                        <div key={type} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{type}:</span>
                            <span>{count} ({percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <h3>Format Legality</h3>
                    <div>
                      {deckStatistics.formatLegality.map(({ format, legal, illegalCards }) => (
                        <div key={format} style={{ marginBottom: 8 }}>
                          <span style={{ color: legal ? '#4CAF50' : '#f44336' }}>
                            {format}: {legal ? '✅ Legal' : '❌ Illegal'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'simulator' && (
            <>
              <section className={styles.inputSection}>
                <h2>Opening Hand Simulator</h2>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button}>
                    Simulate Opening Hand
                  </button>
                </form>
              </section>
              {simulatedHand && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Simulated Opening Hand</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#aaa' }}>
                      Randomly drawn 7 cards from your deck
                    </p>
                  </div>
                  <div className={styles.rightPanel}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                      gap: '12px',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {simulatedHand.cards.map((card, index) => (
                        <div key={index} style={{
                          background: '#1a1a1a',
                          borderRadius: '8px',
                          padding: '8px',
                          border: '1px solid #444',
                          textAlign: 'center'
                        }}>
                          {card.imageUrl ? (
                            <img 
                              src={card.imageUrl} 
                              alt={card.name}
                              style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: '4px',
                                marginBottom: '8px'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: '100%',
                              height: '120px',
                              background: '#333',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginBottom: '8px',
                              color: '#888',
                              fontSize: '0.8rem'
                            }}>
                              No Image
                            </div>
                          )}
                          <div style={{ fontSize: '0.8rem', color: '#e0e0e0' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.name}</div>
                            <div style={{ color: '#888' }}>{card.manaCost || 'No cost'}</div>
                            <div style={{ color: '#888', fontSize: '0.7rem' }}>{card.typeLine || 'Unknown type'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'manabase' && (
            <>
              <section className={styles.inputSection}>
                <h2>Mana Base Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isAnalyzingDeck}>
                    {isAnalyzingDeck ? 'Analyzing...' : 'Analyze Mana Base'}
                  </button>
                </form>
              </section>
              {deckAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Deck Statistics</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Total Cards:</strong> {deckAnalysis.totalCards}</p>
                      <p><strong>Non-Land Cards:</strong> {deckAnalysis.nonLandCards}</p>
                      <p><strong>Land Cards:</strong> {deckAnalysis.landCards}</p>
                      <p><strong>Average CMC:</strong> {deckAnalysis.averageCMC.toFixed(2)}</p>
                    </div>
                    <h3>Mana Pip Breakdown</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><span style={{ color: '#f4d03f' }}>●</span> White: {deckAnalysis.manaPips.W}</p>
                      <p><span style={{ color: '#3498db' }}>●</span> Blue: {deckAnalysis.manaPips.U}</p>
                      <p><span style={{ color: '#8e44ad' }}>●</span> Black: {deckAnalysis.manaPips.B}</p>
                      <p><span style={{ color: '#e74c3c' }}>●</span> Red: {deckAnalysis.manaPips.R}</p>
                      <p><span style={{ color: '#27ae60' }}>●</span> Green: {deckAnalysis.manaPips.G}</p>
                      <p><span style={{ color: '#95a5a6' }}>●</span> Colorless: {deckAnalysis.manaPips.C}</p>
                      <p><strong>Total Pips:</strong> {deckAnalysis.manaPips.total}</p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Land Drop Probabilities</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#aaa' }}>
                      Using hypergeometric distribution: P(X ≥ k) = Σ(i=k to min(n,K)) [C(K,i) * C(N-K, n-i)] / C(N, n)
                    </p>
                    <div style={{ marginBottom: 20 }}>
                      {deckAnalysis.landDropProbabilities.map(({ turn, probability }) => (
                        <div key={turn} style={{ marginBottom: 8 }}>
                          <strong>Turn {turn}:</strong> {(probability * 100).toFixed(1)}% chance of {turn}+ lands
                          <div style={{ fontSize: '0.8rem', color: '#888', marginLeft: 16 }}>
                            N={deckAnalysis.totalCards}, K={deckAnalysis.landCards}, n={7 + (turn - 1)}, k={turn}
                          </div>
                        </div>
                      ))}
                    </div>
                    <h3>Land Recommendations</h3>
                    <div>
                      <p><strong>Current Land Count:</strong> {deckAnalysis.landCards}</p>
                      <p><strong>Recommended Range:</strong> {Math.max(20, Math.floor(deckAnalysis.totalCards * 0.35))} - {Math.min(40, Math.ceil(deckAnalysis.totalCards * 0.45))}</p>
                      {deckAnalysis.landCards < Math.floor(deckAnalysis.totalCards * 0.35) && (
                        <p style={{ color: '#e74c3c' }}>⚠️ Consider adding more lands</p>
                      )}
                      {deckAnalysis.landCards > Math.ceil(deckAnalysis.totalCards * 0.45) && (
                        <p style={{ color: '#f39c12' }}>⚠️ Consider reducing lands</p>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'oncurve' && (
            <>
              <section className={styles.inputSection}>
                <h2>On Curve Probability Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label htmlFor="turn" style={{ display: 'block', marginBottom: 4 }}>Turn:</label>
                      <select
                        id="turn"
                        value={onCurveInputs.turn}
                        onChange={(e) => setOnCurveInputs(prev => ({ ...prev, turn: parseInt(e.target.value) }))}
                        style={{ padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      >
                        {[2, 3, 4, 5, 6].map(turn => (
                          <option key={turn} value={turn}>Turn {turn}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cmc" style={{ display: 'block', marginBottom: 4 }}>CMC:</label>
                      <select
                        id="cmc"
                        value={onCurveInputs.targetCMC}
                        onChange={(e) => setOnCurveInputs(prev => ({ ...prev, targetCMC: parseInt(e.target.value) }))}
                        style={{ padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      >
                        {[1, 2, 3, 4, 5, 6, 7].map(cmc => (
                          <option key={cmc} value={cmc}>{cmc}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="playDraw" style={{ display: 'block', marginBottom: 4 }}>Play/Draw:</label>
                      <select
                        id="playDraw"
                        value={onCurveInputs.playDraw}
                        onChange={(e) => setOnCurveInputs(prev => ({ ...prev, playDraw: e.target.value as 'play' | 'draw' }))}
                        style={{ padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      >
                        <option value="play">On Play</option>
                        <option value="draw">On Draw</option>
                      </select>
                    </div>
                  </div>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isCalculatingOnCurve}>
                    {isCalculatingOnCurve ? 'Calculating...' : 'Calculate On-Curve Probability'}
                  </button>
                </form>
              </section>
              {onCurveAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>On-Curve Probability</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Turn {onCurveAnalysis.turn} {onCurveAnalysis.targetCMC}-drop on {onCurveAnalysis.playDraw}:</strong></p>
                      <p style={{ fontSize: '1.5rem', color: '#00bcd4', fontWeight: 'bold' }}>
                        {(onCurveAnalysis.combinedProbability * 100).toFixed(1)}%
                      </p>
                    </div>
                    <h3>Breakdown</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Lands Probability:</strong> {(onCurveAnalysis.landProbability * 100).toFixed(1)}%</p>
                      <p><strong>Spell Probability:</strong> {(onCurveAnalysis.spellProbability * 100).toFixed(1)}%</p>
                      <p><strong>Combined:</strong> {(onCurveAnalysis.combinedProbability * 100).toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Calculation Details</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#aaa' }}>
                      Using hypergeometric distribution: P(X ≥ k) = Σ(i=k to min(n,K)) [C(K,i) * C(N-K, n-i)] / C(N, n)
                    </p>
                    <div style={{ marginBottom: 20 }}>
                      <h4>Land Calculation:</h4>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginLeft: 16, marginBottom: 8 }}>
                        N={onCurveAnalysis.calculationDetails.landCalc.N} (deck size)<br/>
                        K={onCurveAnalysis.calculationDetails.landCalc.K} (lands in deck)<br/>
                        n={onCurveAnalysis.calculationDetails.landCalc.n} (cards drawn)<br/>
                        k={onCurveAnalysis.calculationDetails.landCalc.k} (lands needed)
                      </div>
                      <h4>Spell Calculation:</h4>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginLeft: 16, marginBottom: 8 }}>
                        N={onCurveAnalysis.calculationDetails.spellCalc.N} (deck size)<br/>
                        K={onCurveAnalysis.calculationDetails.spellCalc.K} (spells of CMC {onCurveAnalysis.targetCMC})<br/>
                        n={onCurveAnalysis.calculationDetails.spellCalc.n} (cards drawn)<br/>
                        k={onCurveAnalysis.calculationDetails.spellCalc.k} (spells needed)
                      </div>
                    </div>
                    <div style={{ background: '#181c22', padding: 12, borderRadius: 8, fontSize: '0.9rem' }}>
                      <strong>Note:</strong> This calculation assumes independence between drawing lands and spells. 
                      The actual probability may be slightly different due to the finite nature of the deck.
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'twocard' && (
            <>
              <section className={styles.inputSection}>
                <h2>Two-Card Combo Probability Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="cardA" style={{ display: 'block', marginBottom: 4 }}>Card A:</label>
                      <input
                        id="cardA"
                        type="text"
                        value={twoCardInputs.cardA}
                        onChange={(e) => setTwoCardInputs(prev => ({ ...prev, cardA: e.target.value }))}
                        placeholder="Enter card name"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label htmlFor="cardB" style={{ display: 'block', marginBottom: 4 }}>Card B:</label>
                      <input
                        id="cardB"
                        type="text"
                        value={twoCardInputs.cardB}
                        onChange={(e) => setTwoCardInputs(prev => ({ ...prev, cardB: e.target.value }))}
                        placeholder="Enter card name"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cardsDrawn" style={{ display: 'block', marginBottom: 4 }}>Cards Drawn:</label>
                      <input
                        id="cardsDrawn"
                        type="number"
                        value={twoCardInputs.cardsDrawn}
                        onChange={(e) => setTwoCardInputs(prev => ({ ...prev, cardsDrawn: parseInt(e.target.value) }))}
                        min="1"
                        max="60"
                        style={{ width: '80px', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                  </div>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button 
                    type="submit" 
                    className={styles.button} 
                    disabled={isCalculatingTwoCard || !twoCardInputs.cardA || !twoCardInputs.cardB || !decklistText.trim()}
                  >
                    {isCalculatingTwoCard ? 'Calculating...' : 'Calculate Two-Card Combo Probability'}
                  </button>
                  {(!twoCardInputs.cardA || !twoCardInputs.cardB || !decklistText.trim()) && (
                    <p style={{ color: '#f44336', fontSize: '0.9rem', marginTop: '8px' }}>
                      Please fill in both card names and provide a decklist
                    </p>
                  )}
                </form>
              </section>
              {twoCardComboAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Two-Card Combo Probability</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Drawing both "{twoCardComboAnalysis.cardA}" and "{twoCardComboAnalysis.cardB}" in {twoCardComboAnalysis.cardsDrawn} cards:</strong></p>
                      <p style={{ fontSize: '1.5rem', color: '#00bcd4', fontWeight: 'bold' }}>
                        {(twoCardComboAnalysis.probability * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Calculation Details</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#aaa' }}>
                      Using inclusion-exclusion principle: P(A and B) = 1 - P(A missing OR B missing)
                    </p>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 16 }}>
                      <p><strong>Deck Size (N):</strong> {twoCardComboAnalysis.calculationDetails.N}</p>
                      <p><strong>Copies of {twoCardComboAnalysis.cardA} (KA):</strong> {twoCardComboAnalysis.calculationDetails.KA}</p>
                      <p><strong>Copies of {twoCardComboAnalysis.cardB} (KB):</strong> {twoCardComboAnalysis.calculationDetails.KB}</p>
                      <p><strong>Cards Drawn (n):</strong> {twoCardComboAnalysis.calculationDetails.n}</p>
                    </div>
                    <div style={{ background: '#181c22', padding: 12, borderRadius: 8, fontSize: '0.9rem' }}>
                      <strong>Note:</strong> This calculation uses the inclusion-exclusion principle to find the probability of drawing at least one copy of both cards.
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'stormcount' && (
            <>
              <section className={styles.inputSection}>
                <h2>Storm Count / Spell Count Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isAnalyzingStorm}>
                    {isAnalyzingStorm ? 'Analyzing...' : 'Analyze Storm Count'}
                  </button>
                </form>
              </section>
              {stormCountAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Storm Count Analysis</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Total Spells:</strong> {stormCountAnalysis.totalSpells}</p>
                      <p><strong>Storm Spells:</strong> {stormCountAnalysis.stormSpells}</p>
                      <p><strong>Cantrip Spells:</strong> {stormCountAnalysis.cantripSpells}</p>
                      <p><strong>Low-Cost Spells (CMC ≤ 2):</strong> {stormCountAnalysis.lowCostSpells}</p>
                    </div>
                    <h3>Storm Cards</h3>
                    <div style={{ marginBottom: 20 }}>
                      {stormCountAnalysis.breakdown.storm.length > 0 ? (
                        <ul style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>
                          {stormCountAnalysis.breakdown.storm.map((card, index) => (
                            <li key={index}>{card}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: '#888', fontSize: '0.9rem' }}>No Storm cards found</p>
                      )}
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Cantrip Spells</h3>
                    <div style={{ marginBottom: 20 }}>
                      {stormCountAnalysis.breakdown.cantrips.length > 0 ? (
                        <ul style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>
                          {stormCountAnalysis.breakdown.cantrips.map((card, index) => (
                            <li key={index}>{card}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: '#888', fontSize: '0.9rem' }}>No cantrip spells found</p>
                      )}
                    </div>
                    <h3>Low-Cost Spells (CMC ≤ 2)</h3>
                    <div>
                      {stormCountAnalysis.breakdown.lowCost.length > 0 ? (
                        <ul style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>
                          {stormCountAnalysis.breakdown.lowCost.map((card, index) => (
                            <li key={index}>{card}</li>
                          ))}
                        </ul>
                      ) : (
                        <p style={{ color: '#888', fontSize: '0.9rem' }}>No low-cost spells found</p>
                      )}
                    </div>
                    <div style={{ background: '#181c22', padding: 12, borderRadius: 8, fontSize: '0.9rem', marginTop: 16 }}>
                      <strong>Note:</strong> This is a simplified analysis. Storm count includes cards with "Storm" keyword. Cantrips include spells that draw cards. Low-cost spells are CMC ≤ 2.
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'advancedsearch' && (
            <>
              <section className={styles.inputSection}>
                <h2>Multi-Criteria Search</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label htmlFor="cardName" style={{ display: 'block', marginBottom: 4 }}>Card Name:</label>
                      <input
                        id="cardName"
                        type="text"
                        value={multiCriteriaSearch.cardName}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, cardName: e.target.value }))}
                        placeholder="Partial or full name"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cardType" style={{ display: 'block', marginBottom: 4 }}>Card Type:</label>
                      <select
                        id="cardType"
                        value={multiCriteriaSearch.cardType}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, cardType: e.target.value }))}
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      >
                        <option value="">Any Type</option>
                        <option value="creature">Creature</option>
                        <option value="instant">Instant</option>
                        <option value="sorcery">Sorcery</option>
                        <option value="artifact">Artifact</option>
                        <option value="enchantment">Enchantment</option>
                        <option value="planeswalker">Planeswalker</option>
                        <option value="land">Land</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="colorIdentity" style={{ display: 'block', marginBottom: 4 }}>Color Identity:</label>
                      <input
                        id="colorIdentity"
                        type="text"
                        value={multiCriteriaSearch.colorIdentity}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, colorIdentity: e.target.value }))}
                        placeholder="e.g., Red, Blue/Black"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="keywords" style={{ display: 'block', marginBottom: 4 }}>Keywords/Oracle Text:</label>
                      <input
                        id="keywords"
                        type="text"
                        value={multiCriteriaSearch.keywords}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, keywords: e.target.value }))}
                        placeholder="e.g., draw a card, target creature"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="power" style={{ display: 'block', marginBottom: 4 }}>Power:</label>
                      <input
                        id="power"
                        type="text"
                        value={multiCriteriaSearch.power}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, power: e.target.value }))}
                        placeholder="e.g., 3, 4+"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="toughness" style={{ display: 'block', marginBottom: 4 }}>Toughness:</label>
                      <input
                        id="toughness"
                        type="text"
                        value={multiCriteriaSearch.toughness}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, toughness: e.target.value }))}
                        placeholder="e.g., 3, 4+"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cmc" style={{ display: 'block', marginBottom: 4 }}>CMC:</label>
                      <input
                        id="cmc"
                        type="text"
                        value={multiCriteriaSearch.cmc}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, cmc: e.target.value }))}
                        placeholder="e.g., 3, 4+"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="setCode" style={{ display: 'block', marginBottom: 4 }}>Set Code:</label>
                      <input
                        id="setCode"
                        type="text"
                        value={multiCriteriaSearch.setCode}
                        onChange={(e) => setMultiCriteriaSearch(prev => ({ ...prev, setCode: e.target.value }))}
                        placeholder="e.g., OTJ, MH3"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                  </div>
                  <button type="submit" className={styles.button} disabled={isAdvancedSearching}>
                    {isAdvancedSearching ? 'Searching...' : 'Search Cards'}
                  </button>
                </form>
              </section>
              {advancedSearchResults.length > 0 && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <h3>Search Results ({advancedSearchResults.length})</h3>
                      <button
                        onClick={() => setShowGalleryView(!showGalleryView)}
                        className={styles.button}
                        style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                      >
                        {showGalleryView ? 'List View' : 'Gallery View'}
                      </button>
                    </div>
                    {showGalleryView ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                        gap: '12px',
                        maxHeight: '500px',
                        overflowY: 'auto'
                      }}>
                        {advancedSearchResults.map((card) => (
                          <div
                            key={card.id}
                            style={{
                              background: '#1a1a1a',
                              borderRadius: '8px',
                              padding: '8px',
                              border: '1px solid #444',
                              textAlign: 'center',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => handleCardHover(card.name, e)}
                            onMouseLeave={handleCardLeave}
                          >
                            {card.image_uris?.normal ? (
                              <img
                                src={card.image_uris.normal}
                                alt={card.name}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  borderRadius: '4px',
                                  marginBottom: '8px'
                                }}
                              />
                            ) : (
                              <div style={{
                                width: '100%',
                                height: '120px',
                                background: '#333',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '8px',
                                color: '#888',
                                fontSize: '0.8rem'
                              }}>
                                No Image
                              </div>
                            )}
                            <div style={{ fontSize: '0.8rem', color: '#e0e0e0' }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.name}</div>
                              <div style={{ color: '#888' }}>{card.mana_cost || 'No cost'}</div>
                              <div style={{ color: '#888', fontSize: '0.7rem' }}>{card.type_line || 'Unknown type'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        {advancedSearchResults.map((card) => (
                          <div
                            key={card.id}
                            style={{
                              padding: '12px',
                              borderBottom: '1px solid #444',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                            onMouseEnter={(e) => handleCardHover(card.name, e)}
                            onMouseLeave={handleCardLeave}
                          >
                            {card.image_uris?.normal && (
                              <img
                                src={card.image_uris.normal}
                                alt={card.name}
                                style={{
                                  width: '60px',
                                  height: 'auto',
                                  borderRadius: '4px'
                                }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{card.name}</div>
                              <div style={{ color: '#888', fontSize: '0.9rem' }}>
                                {card.mana_cost || 'No cost'} • {card.type_line || 'Unknown type'}
                                {card.cmc !== undefined && ` • CMC: ${card.cmc}`}
                                {card.power && card.toughness && ` • ${card.power}/${card.toughness}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>External Links</h3>
                    <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: 16 }}>
                      Click on a card to see external resources
                    </p>
                                         <div style={{ fontSize: '0.9rem', color: '#888' }}>
                       <p>• EDHREC - Commander recommendations</p>
                       <p>• Gatherer - Official card database</p>
                     </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'combos' && (
            <>
              <section className={styles.inputSection}>
                <h2>Combo Detection</h2>
                <p style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: 16 }}>
                  Find known combos from Commander Spellbook that are present in your deck
                </p>
                <form onSubmit={handleSubmit}>
                  <textarea
                    value={decklistText}
                    onChange={handleDecklistChange}
                    placeholder="e.g.,\n2 Sol Ring\n1 Arcane Signet\nLightning Greaves\nKaalia of the Vast"
                    rows={8}
                    className={styles.textarea}
                  />
                  <button type="submit" className={styles.button} disabled={isDetectingCombos || !decklistText.trim()}>
                    {isDetectingCombos ? 'Detecting Combos...' : 'Detect Combos'}
                  </button>
                  {!decklistText.trim() && (
                    <p style={{ color: '#f44336', fontSize: '0.9rem', marginTop: '8px' }}>
                      Please provide a decklist to detect combos
                    </p>
                  )}
                </form>
              </section>
              {comboDetectionAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Detected Combos ({comboDetectionAnalysis.totalCombos})</h3>
                    {comboDetectionAnalysis.totalCombos === 0 ? (
                      <p style={{ color: '#888', fontSize: '0.9rem' }}>
                        No known combos found in your deck. This could mean your deck doesn't contain any known combo pieces, or the combos in your deck aren't in the Commander Spellbook database.
                      </p>
                    ) : (
                      <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        {comboDetectionAnalysis.combos.map((combo, index) => (
                          <div
                            key={combo.id}
                            style={{
                              background: '#1a1a1a',
                              borderRadius: '8px',
                              padding: '16px',
                              marginBottom: '16px',
                              border: '1px solid #444'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <h4 style={{ color: '#00bcd4', margin: 0 }}>{combo.name}</h4>
                              <a
                                href={`https://commanderspellbook.com/combo/${combo.id}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.button}
                                style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                              >
                                View Details
                              </a>
                            </div>
                            
                            <div style={{ marginBottom: '12px' }}>
                              <strong style={{ color: '#e0e0e0' }}>Cards:</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                {combo.cards.map((card, cardIndex) => (
                                  <span
                                    key={cardIndex}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem',
                                      background: card.inDeck ? '#4CAF50' : '#666',
                                      color: '#fff'
                                    }}
                                  >
                                    {card.name} {card.inDeck ? '✓' : '✗'}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {combo.results.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#e0e0e0' }}>Results:</strong>
                                <div style={{ fontSize: '0.9rem', color: '#ccc', marginTop: '4px' }}>
                                  {combo.results.map((result, resultIndex) => (
                                    <div key={resultIndex}>• {result.name}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {combo.prerequisites && combo.prerequisites.length > 0 && (
                              <div style={{ marginBottom: '12px' }}>
                                <strong style={{ color: '#e0e0e0' }}>Prerequisites:</strong>
                                <div style={{ fontSize: '0.9rem', color: '#ccc', marginTop: '4px' }}>
                                  {combo.prerequisites.map((prereq, prereqIndex) => (
                                    <div key={prereqIndex}>• {prereq}</div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {combo.steps && combo.steps.length > 0 && (
                              <div>
                                <strong style={{ color: '#e0e0e0' }}>Steps:</strong>
                                <div style={{ fontSize: '0.9rem', color: '#ccc', marginTop: '4px' }}>
                                  {combo.steps.map((step, stepIndex) => (
                                    <div key={stepIndex}>{stepIndex + 1}. {step}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>About Combo Detection</h3>
                    <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: 16 }}>
                      <p>This tool searches the Commander Spellbook database for known combos that can be assembled from cards in your deck.</p>
                      <p style={{ marginTop: 12 }}>
                        <strong>Card Status:</strong><br/>
                        <span style={{ color: '#4CAF50' }}>✓ Green</span> - Card is in your deck<br/>
                        <span style={{ color: '#666' }}>✗ Gray</span> - Card is not in your deck
                      </p>
                    </div>
                    <h3>Deck Summary</h3>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>
                      <p><strong>Total Cards:</strong> {comboDetectionAnalysis.deckCards.length}</p>
                      <p><strong>Combos Found:</strong> {comboDetectionAnalysis.totalCombos}</p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'cardtype' && (
            <>
              <section className={styles.inputSection}>
                <h2>Card Type Drawn Probability Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label htmlFor="deckSize" style={{ display: 'block', marginBottom: 4 }}>Deck Size:</label>
                      <input
                        id="deckSize"
                        type="number"
                        value={cardTypeInputs.deckSize}
                        onChange={(e) => setCardTypeInputs(prev => ({ ...prev, deckSize: parseInt(e.target.value) }))}
                        min="40"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cardTypeCount" style={{ display: 'block', marginBottom: 4 }}>Cards of Type in Deck:</label>
                      <input
                        id="cardTypeCount"
                        type="number"
                        value={cardTypeInputs.cardTypeCount}
                        onChange={(e) => setCardTypeInputs(prev => ({ ...prev, cardTypeCount: parseInt(e.target.value) }))}
                        min="0"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="desiredCount" style={{ display: 'block', marginBottom: 4 }}>How Many Do You Want?:</label>
                      <input
                        id="desiredCount"
                        type="number"
                        value={cardTypeInputs.desiredCount}
                        onChange={(e) => setCardTypeInputs(prev => ({ ...prev, desiredCount: parseInt(e.target.value) }))}
                        min="1"
                        max="10"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="targetTurn" style={{ display: 'block', marginBottom: 4 }}>What Turn Do You Want Them By?:</label>
                      <input
                        id="targetTurn"
                        type="number"
                        value={cardTypeInputs.targetTurn}
                        onChange={(e) => setCardTypeInputs(prev => ({ ...prev, targetTurn: parseInt(e.target.value) }))}
                        min="1"
                        max="10"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="playDraw" style={{ display: 'block', marginBottom: 4 }}>Play/Draw:</label>
                      <select
                        id="playDraw"
                        value={cardTypeInputs.playDraw}
                        onChange={(e) => setCardTypeInputs(prev => ({ ...prev, playDraw: e.target.value as 'play' | 'draw' }))}
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      >
                        <option value="play">On Play</option>
                        <option value="draw">On Draw</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className={styles.button} disabled={isCalculatingCardType}>
                    {isCalculatingCardType ? 'Calculating...' : 'Calculate Probability'}
                  </button>
                </form>
              </section>
              {cardTypeDrawnAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Card Type Drawn Probability</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Drawing at least {cardTypeDrawnAnalysis.desiredCount} cards of the specified type by turn {cardTypeDrawnAnalysis.targetTurn} on {cardTypeDrawnAnalysis.playDraw}:</strong></p>
                      <p style={{ fontSize: '1.5rem', color: '#00bcd4', fontWeight: 'bold' }}>
                        {(cardTypeDrawnAnalysis.probability * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Calculation Details</h3>
                    <p style={{ marginBottom: 16, fontSize: '0.9rem', color: '#aaa' }}>
                      Using hypergeometric distribution: P(X ≥ k) = Σ(i=k to min(n,K)) [C(K,i) * C(N-K, n-i)] / C(N, n)
                    </p>
                    <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: 16 }}>
                      <p><strong>Deck Size (N):</strong> {cardTypeDrawnAnalysis.calculationDetails.N}</p>
                      <p><strong>Cards of Type (K):</strong> {cardTypeDrawnAnalysis.calculationDetails.K}</p>
                      <p><strong>Cards Drawn (n):</strong> {cardTypeDrawnAnalysis.calculationDetails.n}</p>
                      <p><strong>Desired Count (k):</strong> {cardTypeDrawnAnalysis.calculationDetails.k}</p>
                    </div>
                    <div style={{ background: '#181c22', padding: 12, borderRadius: 8, fontSize: '0.9rem' }}>
                      <strong>Note:</strong> This calculation assumes you want at least the specified number of cards by the target turn.
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
          {sidebarSection === 'mulligan' && (
            <>
              <section className={styles.inputSection}>
                <h2>Mulligan Strategy Calculator</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label htmlFor="mulliganDeckSize" style={{ display: 'block', marginBottom: 4 }}>Deck Size:</label>
                      <input
                        id="mulliganDeckSize"
                        type="number"
                        value={mulliganInputs.deckSize}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, deckSize: parseInt(e.target.value) }))}
                        min="40"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="freeMulligan" style={{ display: 'block', marginBottom: 4 }}>Free Mulligan:</label>
                      <input
                        id="freeMulligan"
                        type="checkbox"
                        checked={mulliganInputs.freeMulligan}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, freeMulligan: e.target.checked }))}
                        style={{ marginLeft: 8 }}
                      />
                      <span style={{ marginLeft: 8, fontSize: '0.9rem', color: '#aaa' }}>
                        Current MTG rule (Scry 1 for each mulligan beyond first)
                      </span>
                    </div>
                    <div>
                      <label htmlFor="typeAName" style={{ display: 'block', marginBottom: 4 }}>Type A Name:</label>
                      <input
                        id="typeAName"
                        type="text"
                        value={mulliganInputs.typeA.name}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeA: { ...prev.typeA, name: e.target.value } }))}
                        placeholder="e.g., Lands"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeACount" style={{ display: 'block', marginBottom: 4 }}>Type A Count:</label>
                      <input
                        id="typeACount"
                        type="number"
                        value={mulliganInputs.typeA.count}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeA: { ...prev.typeA, count: parseInt(e.target.value) } }))}
                        min="0"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeADesired" style={{ display: 'block', marginBottom: 4 }}>Type A Desired:</label>
                      <input
                        id="typeADesired"
                        type="number"
                        value={mulliganInputs.typeA.desired}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeA: { ...prev.typeA, desired: parseInt(e.target.value) } }))}
                        min="0"
                        max="7"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeBName" style={{ display: 'block', marginBottom: 4 }}>Type B Name:</label>
                      <input
                        id="typeBName"
                        type="text"
                        value={mulliganInputs.typeB.name}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeB: { ...prev.typeB, name: e.target.value } }))}
                        placeholder="e.g., Ramp"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeBCount" style={{ display: 'block', marginBottom: 4 }}>Type B Count:</label>
                      <input
                        id="typeBCount"
                        type="number"
                        value={mulliganInputs.typeB.count}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeB: { ...prev.typeB, count: parseInt(e.target.value) } }))}
                        min="0"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeBDesired" style={{ display: 'block', marginBottom: 4 }}>Type B Desired:</label>
                      <input
                        id="typeBDesired"
                        type="number"
                        value={mulliganInputs.typeB.desired}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeB: { ...prev.typeB, desired: parseInt(e.target.value) } }))}
                        min="0"
                        max="7"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeCName" style={{ display: 'block', marginBottom: 4 }}>Type C Name:</label>
                      <input
                        id="typeCName"
                        type="text"
                        value={mulliganInputs.typeC.name}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeC: { ...prev.typeC, name: e.target.value } }))}
                        placeholder="e.g., Interaction"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeCCount" style={{ display: 'block', marginBottom: 4 }}>Type C Count:</label>
                      <input
                        id="typeCCount"
                        type="number"
                        value={mulliganInputs.typeC.count}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeC: { ...prev.typeC, count: parseInt(e.target.value) } }))}
                        min="0"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="typeCDesired" style={{ display: 'block', marginBottom: 4 }}>Type C Desired:</label>
                      <input
                        id="typeCDesired"
                        type="number"
                        value={mulliganInputs.typeC.desired}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, typeC: { ...prev.typeC, desired: parseInt(e.target.value) } }))}
                        min="0"
                        max="7"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="penaltyPercentage" style={{ display: 'block', marginBottom: 4 }}>Penalty for Non-Free Mulligans (%):</label>
                      <input
                        id="penaltyPercentage"
                        type="number"
                        value={mulliganInputs.penaltyPercentage}
                        onChange={(e) => setMulliganInputs(prev => ({ ...prev, penaltyPercentage: parseInt(e.target.value) }))}
                        min="0"
                        max="100"
                        style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #555', background: '#333', color: '#e0e0e0' }}
                      />
                    </div>
                  </div>
                  <button type="submit" className={styles.button} disabled={isCalculatingMulligan}>
                    {isCalculatingMulligan ? 'Calculating...' : 'Calculate Mulligan Strategy'}
                  </button>
                </form>
              </section>
              {mulliganStrategyAnalysis && (
                <section className={styles.resultsSection}>
                  <div className={styles.leftPanel}>
                    <h3>Mulligan Strategy Results</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>Probability of Keepable Hand:</strong></p>
                      <p style={{ fontSize: '1.5rem', color: '#00bcd4', fontWeight: 'bold' }}>
                        {(mulliganStrategyAnalysis.results.keepableHandProbability * 100).toFixed(1)}%
                      </p>
                      <p><strong>Expected Mulligans:</strong></p>
                      <p style={{ fontSize: '1.2rem', color: '#e0e0e0' }}>
                        {mulliganStrategyAnalysis.results.expectedMulligans.toFixed(1)}
                      </p>
                    </div>
                    <h3>Average Cards in Opening Hand</h3>
                    <div style={{ marginBottom: 20 }}>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeA.name}:</strong> {mulliganStrategyAnalysis.results.averageTypeA.toFixed(2)}</p>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeB.name}:</strong> {mulliganStrategyAnalysis.results.averageTypeB.toFixed(2)}</p>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeC.name}:</strong> {mulliganStrategyAnalysis.results.averageTypeC.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className={styles.rightPanel}>
                    <h3>Configuration</h3>
                    <div style={{ fontSize: '0.9rem', color: '#888', marginBottom: 16 }}>
                      <p><strong>Deck Size:</strong> {mulliganStrategyAnalysis.deckSize}</p>
                      <p><strong>Free Mulligan:</strong> {mulliganStrategyAnalysis.freeMulligan ? 'Yes' : 'No'}</p>
                      <p><strong>Penalty:</strong> {mulliganStrategyAnalysis.penaltyPercentage}%</p>
                    </div>
                    <h3>Card Type Requirements</h3>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeA.name}:</strong> {mulliganStrategyAnalysis.cardTypes.typeA.count} in deck, want {mulliganStrategyAnalysis.cardTypes.typeA.desired}</p>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeB.name}:</strong> {mulliganStrategyAnalysis.cardTypes.typeB.count} in deck, want {mulliganStrategyAnalysis.cardTypes.typeB.desired}</p>
                      <p><strong>{mulliganStrategyAnalysis.cardTypes.typeC.name}:</strong> {mulliganStrategyAnalysis.cardTypes.typeC.count} in deck, want {mulliganStrategyAnalysis.cardTypes.typeC.desired}</p>
                    </div>
                    <div style={{ background: '#181c22', padding: 12, borderRadius: 8, fontSize: '0.9rem', marginTop: 16 }}>
                      <strong>Note:</strong> This is a simplified calculation. A "keepable hand" is defined as having at least the desired number of each card type with 50%+ probability.
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
      
      {/* Hover Card Details Tooltip */}
      {hoveredCard && (
        <div
          style={{
            position: 'fixed',
            left: hoverPosition.x + 10,
            top: hoverPosition.y - 10,
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '8px',
            padding: '16px',
            maxWidth: '300px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            fontSize: '0.9rem',
            color: '#e0e0e0'
          }}
        >
          <h4 style={{ marginBottom: '8px', color: '#00bcd4' }}>{hoveredCard.name}</h4>
          {hoveredCard.oracle_text && (
            <div style={{ marginBottom: '8px' }}>
              <strong>Oracle Text:</strong>
              <div style={{ fontSize: '0.8rem', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                {hoveredCard.oracle_text}
              </div>
            </div>
          )}
          {hoveredCard.flavor_text && (
            <div style={{ marginBottom: '8px', fontStyle: 'italic', color: '#888' }}>
              <div style={{ fontSize: '0.8rem' }}>{hoveredCard.flavor_text}</div>
            </div>
          )}
          <div style={{ fontSize: '0.8rem', color: '#888' }}>
            {hoveredCard.artist && <div><strong>Artist:</strong> {hoveredCard.artist}</div>}
            {hoveredCard.set_name && <div><strong>Set:</strong> {hoveredCard.set_name}</div>}
            {hoveredCard.collector_number && <div><strong>Number:</strong> {hoveredCard.collector_number}</div>}
          </div>
          {hoveredCard.legalities && (
            <div style={{ marginTop: '8px' }}>
              <strong>Legalities:</strong>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {Object.entries(hoveredCard.legalities).slice(0, 5).map(([format, status]) => (
                  <div key={format} style={{ color: status === 'legal' ? '#4CAF50' : '#f44336' }}>
                    {format}: {status}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      <footer className={styles.footer}>
        <p>MTG Decklist Searcher</p>
      </footer>
    </div>
  );
}