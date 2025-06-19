// __tests__/page.test.tsx (conceptual)
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // For extended matchers like .toBeInTheDocument()
import HomePage from '../src/app/page'; // Adjust path as needed

// Mock Scryfall API
global.fetch = jest.fn() as jest.Mock;

// Mock localStorage
let store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value.toString(); },
  clear: () => { store = {}; }
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });


describe('HomePage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
    // General successful mock for Scryfall API for all tests
    // It will try fuzzy first, then exact. Mock both to return ok: true for simplicity.
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      const urlObj = new URL(url);
      const cardName = decodeURIComponent(urlObj.searchParams.get('fuzzy') || urlObj.searchParams.get('exact') || 'Unknown Card');
      return {
        ok: true,
        json: async () => ({ 
          name: cardName, // Echo back the card name for consistency in mocks
          image_uris: { normal: `${cardName.toLowerCase().replace(/\s+/g, '_')}_url.jpg` } 
        }),
      };
    });
    store = {}; // Clear localStorage before each test
  });

  it('should parse a simple decklist and display card names', async () => {
    render(<HomePage />);
    const textarea = screen.getByPlaceholderText(/e.g.,/i);
    const parseButton = screen.getByRole('button', { name: /Parse Deck & Find Cards/i });

    await userEvent.type(textarea, '2 Sol Ring\n1 Arcane Signet');
    fireEvent.click(parseButton);
    
    await waitFor(() => {
      // Check within the card list for the items
      const cardList = screen.getByRole('list', { name: /card list/i }); // Assuming an accessible name for the list
      expect(within(cardList).getByText('Sol Ring')).toBeInTheDocument();
      expect(within(cardList).getByText('Arcane Signet')).toBeInTheDocument();
    });
  });

  it('should strip set codes and collector numbers', async () => {
    render(<HomePage />);
    const textarea = screen.getByPlaceholderText(/e.g.,/i);
    const parseButton = screen.getByRole('button', { name: /Parse Deck & Find Cards/i });

    await userEvent.type(textarea, 'Swords to Plowshares (STA) 10\nBirds of Paradise (M12)');
    fireEvent.click(parseButton);

    await waitFor(() => {
      const cardList = screen.getByRole('list'); // Find the card list (ul)
      expect(within(cardList).getByText('Swords to Plowshares')).toBeInTheDocument();
      expect(within(cardList).getByText('Birds of Paradise')).toBeInTheDocument();
      
      // Verify that set codes are not present in the selected card name display or list
      // The first card ("Swords to Plowshares") should be auto-selected.
      const selectedCardNameHeading = screen.getByRole('heading', { name: 'Swords to Plowshares' });
      expect(selectedCardNameHeading).toBeInTheDocument();
      expect(selectedCardNameHeading.textContent).not.toMatch(/\(STA\)/);

      // Check the list items directly for no set codes
      const listItems = within(cardList).getAllByRole('listitem');
      expect(listItems[0]).toHaveTextContent('Swords to Plowshares');
      expect(listItems[0]).not.toHaveTextContent('(STA)');
      expect(listItems[1]).toHaveTextContent('Birds of Paradise');
      expect(listItems[1]).not.toHaveTextContent('(M12)');
    });
  });

  it('should select a card and display its image and store links', async () => {
    render(<HomePage />);
    const textarea = screen.getByPlaceholderText(/e.g.,/i);
    const parseButton = screen.getByRole('button', { name: /Parse Deck & Find Cards/i });

    await userEvent.type(textarea, "Sensei's Divining Top");
    fireEvent.click(parseButton);

    let cardListItem: HTMLElement;
    await waitFor(() => {
      const cardList = screen.getByRole('list', { name: /card list/i });
      cardListItem = within(cardList).getByText("Sensei's Divining Top");
      expect(cardListItem).toBeInTheDocument();
    });

    fireEvent.click(cardListItem!); // Click the specific list item

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: "Sensei's Divining Top" })).toBeInTheDocument();
      const img = screen.getByAltText("Sensei's Divining Top");
      expect(img).toHaveAttribute('src', "sensei's_divining_top_url.jpg"); 
      
      const link401 = screen.getByRole('link', { name: /Search on 401 Games/i });
      expect(link401.outerHTML).toContain(
        'href="https://store.401games.ca/pages/search-results?q=Sensei\'s%20Divining%20Top"'
      );
      const linkHobbiesville = screen.getByRole('link', { name: /Search on Hobbiesville/i });
      expect(linkHobbiesville.outerHTML).toContain(
        'href="https://hobbiesville.com/search?q=Sensei\'s%20Divining%20Top"'
      );
    });
  });
  
  it('should load decklist from localStorage on initial render', () => {
    localStorage.setItem('mtgDecklist', 'Lightning Bolt\nCounterspell');
    render(<HomePage />);
    expect(screen.getByPlaceholderText(/e.g.,/i)).toHaveValue('Lightning Bolt\nCounterspell');
  });

  it('should save decklist to localStorage on change', async () => {
    render(<HomePage />);
    const textarea = screen.getByPlaceholderText(/e.g.,/i);
    await userEvent.type(textarea, 'Brainstorm');
    expect(localStorage.getItem('mtgDecklist')).toBe('Brainstorm');
  });

});