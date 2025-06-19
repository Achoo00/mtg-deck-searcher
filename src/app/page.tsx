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
}

const stores = [
  { name: "401 Games", urlPattern: "https://store.401games.ca/pages/search-results?q=<CARD_NAME>" },
  { name: "The CG Realm", urlPattern: "https://www.thecgrealm.com/search?q=*<CARD_NAME>*" },
  { name: "Imaginaire", urlPattern: "https://imaginaire.com/en/magic/advanced-search/results.html?q=<CARD_NAME>" },
  { name: "Hobbiesville", urlPattern: "https://hobbiesville.com/search?q=<CARD_NAME>" },
];

const MAX_CONCURRENT_TABS = 15;

export default function HomePage() {
  const [decklistText, setDecklistText] = useState<string>('');
  const [parsedCards, setParsedCards] = useState<Card[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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

  const handleDecklistChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDecklistText(event.target.value);
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    parseDecklistAndFetchImages(decklistText);
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>MTG Card Searcher</h1>
        <p>Moxfield-inspired Layout</p>
      </header>

      <main className={styles.mainContent}>
        <section className={styles.inputSection}>
          <h2>Enter Your Decklist</h2>
          <form onSubmit={handleSubmit}>
            <textarea
              value={decklistText}
              onChange={handleDecklistChange}
              placeholder="e.g.,&#10;2 Sol Ring&#10;1 Arcane Signet&#10;Lightning Greaves&#10;Kaalia of the Vast"
              rows={8}
              className={styles.textarea}
            />
            <button type="submit" className={styles.button} disabled={isLoading}>
              {isLoading ? 'Processing...' : 'Parse Deck & Find Cards'}
            </button>
          </form>
        </section>

        {parsedCards.length > 0 && (
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
                </>
              ) : (
                <p className={styles.placeholderText}>Select a card from the list to see details.</p>
              )}
            </div>

            <div className={styles.rightPanel}>
              <div className={styles.cardListHeader}>
                <h4>Card List ({parsedCards.length})</h4>
              </div>
              <ul className={styles.cardList} aria-label="Card list">
                {parsedCards.map((card) => (
                  <li
                    key={card.name}
                    className={`${styles.cardListItem} ${selectedCard?.name === card.name ? styles.selectedListItem : ''}`}
                    onClick={() => handleSelectCard(card.name)}
                  >
                    {card.name}
                    {card.isLoadingImage && <span className={styles.listItemStatus}> (loading img...)</span>}
                    {card.imageError && <span className={styles.listItemStatusError}> (img err)</span>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      <footer className={styles.footer}>
        <p>MTG Decklist Searcher</p>
      </footer>
    </div>
  );
}