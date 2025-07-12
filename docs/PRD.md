# PRD: MTG Player's Assistant

## 1. Product Overview

### 1.1 Document Title and Version
* PRD: MTG Player's Assistant
* Version: 3.0 (Comprehensive Hybrid Data Model)

### 1.2 Product Summary
The MTG Player's Assistant is a feature-rich web-based utility designed to empower Magic: The Gathering players with insightful deck analysis and powerful probability calculations. By leveraging local Scryfall bulk data for core card information and strategic Scryfall API calls for dynamic searching, the tool aims to provide critical information for deckbuilding decisions, game planning, and understanding deck consistency. This version expands on fundamental probability calculators with extensive deck statistics, advanced search capabilities, and user experience enhancements, all while prioritizing performance and reliability through a hybrid data fetching approach.

## 2. Features

### 2.1 Core Functionality

#### **Local Scryfall Data Management** (Priority: Critical - Foundational)
* **Initial Download/Update Check:** Upon application startup or a user-initiated refresh, the system will check the Scryfall `/bulk-data` API endpoint for the `oracle_cards` bulk data file.
* **Timestamp Comparison:** It will compare the `updated_at` timestamp of the remote bulk data file with the timestamp of the locally stored `oracle_cards.json`.
* **Conditional Download:** If the remote file is newer, the application will download and decompress the new `oracle_cards.json` file, replacing the existing local copy. This ensures the application has up-to-date gameplay data.
* **In-Memory Indexing:** After download (or if the local file is already current), the application will load the `oracle_cards.json` into an efficient in-memory data structure (e.g., a hash map/dictionary keyed by card name and Scryfall ID) for rapid lookups.

#### **Moxfield Decklist Import** (Priority: High)
* Upon successful import, parse the decklist to extract card names and quantities.
* **LOCAL LOOKUP:** For each card name extracted, perform a lookup in the locally cached Scryfall `oracle_cards` data to retrieve comprehensive card data (CMC, colors, type line, oracle text, etc.).
* **API FALLBACK (for missing cards):** If a card name is not found in the local bulk data (e.g., a very recent spoiler not yet in the daily bulk export), a targeted Scryfall API call (`/cards/named?exact={card_name}`) will be made as a fallback. This retrieved data will be cached in-memory for the current session.
* Display the imported decklist in a clear, organized format (e.g., list of card names with quantities, alongside Scryfall-fetched images).

### 2.2 Probability Calculators

#### **Hypergeometric Calculator** (Priority: High)
* **Description:** Calculates the probability of drawing a specific number of "successes" (target cards) within a certain number of draws from a finite population (deck).
* **Inputs:**
    * `N` (Total Deck Size): Automatically populated from imported deck (using locally sourced card data). User can override for custom scenarios.
    * `K` (Number of Target Cards in Deck): Automatically populated by selecting a card from the imported deck, or allowing user to input a number. Uses locally sourced card data to identify "target cards."
    * `n` (Number of Cards Drawn): User input (e.g., 7 for opening hand, 8 for turn 2 on play, etc.).
    * `k` (Number of Copies Desired): User input (e.g., "exactly 1," "at least 2," "at most 3").
* **Calculations/Output:** All calculations performed using the locally stored and indexed card data.
    * `P(X=k)`: Probability of drawing *exactly* k successes.
    * `P(X>=k)`: Probability of drawing *at least* k successes.
    * `P(X<=k)`: Probability of drawing *at most* k successes.
    * Display results as percentages with clear labels.

#### **Mana Base / Land Calculator** (Priority: High)
* **Description:** Helps players determine optimal land counts and color ratios for their deck.
* **Inputs:**
    * Automatically uses imported decklist data, which is sourced from local Scryfall `oracle_cards` data.
* **Calculations/Output:** All calculations performed using the locally stored and indexed card data.
    * **Total Mana Sources Needed Recommendation:** A general recommendation based on average CMC of non-land cards. (Heuristic to be defined).
    * **Color Ratio/Breakdown:** Analyze mana pips (`{W}`, `{U}`, etc.) from mana costs of all non-land cards in the deck. Suggest a proportional count of lands for each color.
    * **Probability to Hit Land Drops:** Integrate with the Hypergeometric Calculator to show probabilities of hitting 2 lands by turn 2, 3 lands by turn 3, etc., based on the actual land count in the imported deck. Provide options for "On Play" vs. "On Draw."

#### **"On Curve" Play Probability** (Priority: Medium)
* **Description:** Calculates the probability of having the necessary mana and a specific spell to cast it "on curve" (e.g., a 2-drop on turn 2).
* **Inputs:**
    * Imported Decklist (sourced from local Scryfall data).
    * User selects target turn (e.g., Turn 2, Turn 3).
    * User selects target CMC spell (e.g., "any 2-CMC spell" or a specific card from their deck).
    * Play/Draw status.
* **Calculations:** All calculations performed using the locally stored and indexed card data.
    * Determine total cards drawn (`n`) based on turn and play/draw status.
    * Perform hypergeometric calculations for:
        * Probability of having sufficient lands.
        * Probability of having at least one target spell.
    * Combine these probabilities (initially, can be a simplified multiplication for practical use cases).
* **Output:** Display the probability as a percentage.

#### **Two-Card Combo Probability** (Priority: Medium)
* **Description:** Calculates the probability of drawing at least one copy of two different, specific cards in a certain number of draws.
* **Inputs:**
    * Imported Decklist (sourced from local Scryfall data).
    * User selects Card A.
    * User selects Card B.
    * Number of cards drawn.
* **Calculations:** All calculations performed using the locally stored and indexed card data.
    * Utilize multivariate hypergeometric distribution principles or the principle of inclusion-exclusion ($P(A \text{ and } B) = 1 - P(\text{A missing OR B missing})$).
* **Output:** Display the probability as a percentage.

#### **Card Type Drawn Probability Calculator** (Priority: Medium)
* **Description:** Calculates the probability of drawing a certain number of cards of a specific "type" (e.g., creatures, lands, specific combo pieces) by a given turn.
* **Inputs:**
    * Deck size: The total number of cards in the deck (e.g., 60 or 100).
    * How many cards of the type are you running?: The total count of the target "type" of card in the deck (this is K in hypergeometric).
    * How many do you want?: The number of cards of that type you wish to draw (this is k in hypergeometric).
    * What turn do you want them by?: The turn number by which you want to have drawn k cards.
* **Calculations:** Direct application of the Hypergeometric Distribution.
    * Map turn number to total cards drawn (n) based on play/draw status.
    * Calculate probability of drawing at least k cards of the specified type.
* **Output:** Display the probability as a percentage.

#### **Mulligan Strategy Calculator** (Priority: Medium)
* **Description:** Helps evaluate the impact of different mulligan decisions by showing probabilities of achieving certain hand qualities after a mulligan.
* **Inputs:**
    * Deck size: Total number of cards in the deck.
    * Free mulligan: A checkbox. If checked, implies the current official MTG mulligan rule (Scry 1 for each mulligan beyond the first, 7-6-5-4-etc.). If unchecked, implies an older rule.
    * How many cards of each type are you running? (ex. A = lands, B = ramp): Allows defining up to three "types" of cards (Type A, Type B, Type C) and their counts in the deck.
    * Penalty for non-free mulligans: A percentage input for custom mulligan rules.
* **Calculations:** Nested hypergeometric calculations for each mulligan step.
    * Implement free mulligan logic (7 -> 7 cards, then 6 -> 6 cards + scry 1, etc.).
    * Calculate probabilities for each hand size and mulligan step.
* **Output:** 
    * Probability of having a keepable hand after X mulligans.
    * Average number of cards of Type A/B/C after mulligans.

#### **Land Drop Miss Calculator** (Priority: Low)
* **Description:** Calculates the average turn on which a player might miss a land drop, given their deck's land count.
* **Inputs:**
    * Deck size: Total number of cards in the deck.
    * How many lands are you running?: Total number of lands in the deck (K for hypergeometric).
* **Calculations:** Iteratively calculate P(have N lands by turn N) for each turn and determine the expected turn of failure.
    * Related to the "Probability to Hit Land Drops" in the Mana Base Calculator.
    * Calculate the expected value of the turn number for the first miss.
* **Output:** Average (arithmetic median) turn to miss a land drop.

#### **Lands in Opening Hand** (Priority: Low)
* **Description:** Calculates the average (arithmetic median) number of lands in an opening hand.
* **Inputs:**
    * Deck size: Total number of cards in the deck.
    * How many lands are you running?: Total number of lands in the deck (K for hypergeometric).
* **Calculations:** Straightforward application of the hypergeometric mean formula: n∗(K/N).
    * "Opening Hand" implies n=7.
    * Calculate the expected value of lands in a 7-card hand.
* **Output:** Average (arithmetic median) number of lands.

#### **Draws Required to Pull Off Combos** (Priority: Low)
* **Description:** Calculates the average number of draws needed to assemble a combo given its constituent pieces.
* **Inputs:**
    * Deck size: Total number of cards in the deck.
    * How many cards fill the role of each combo piece? (Piece A, Piece B, Piece C): The counts for each distinct card/type of card that forms a combo.
* **Calculations:** Expected value of drawing specific cards.
    * For a simple two-card combo, calculate the average number of cards seen until both are present.
    * Can be derived from summing P(have both by draw d)∗d for all possible d.
* **Output:** Average (arithmetic median) number of draws required.

#### **Mulligans for up to 3 Card Types** (Priority: Low)
* **Description:** Specifically tailored to finding a certain number of cards of up to three defined types in an opening hand after mulligans.
* **Inputs:**
    * Deck size: Total deck size.
    * How many of each do you want to draw in your opening hand? (Type A, Type B, Type C): The desired count of each type (e.g., 2 lands, 1 2-drop, 1 counterspell).
    * Show cumulative probability: Checkbox to toggle between probability for exactly X mulligans vs. probability for X or fewer mulligans.
* **Calculations:** Most complex calculation, requiring iteration through mulligan steps.
    * Recalculate probabilities for each step (7, then 6, then 5, etc.).
    * Check for the desired combination of A, B, and C cards.
    * Determine the expected number of mulligans required.
* **Output:** Average (arithmetic median) number of mulligans.

### 2.3 Deck Analysis & Utilities

#### **Deck Statistics Dashboard** (Priority: High)
* **Description:** Provides visual and numerical insights into the imported deck.
* **Outputs:** All outputs derived directly from the locally stored `oracle_cards` data.
    * **Mana Curve Visualization:** Create a bar chart showing the distribution of CMC (Converted Mana Cost/Mana Value) for non-land cards in the deck.
    * **Color Distribution:** Display a breakdown (e.g., pie chart or bar chart) of the number of cards for each color and color combination present in the deck.
    * **Card Type Breakdown:** Show a count and distribution (e.g., bar chart) of cards by type (Creatures, Instants, Sorceries, Lands, Artifacts, Enchantments, Planeswalkers, etc.).
    * **Commander-Specific Stats (if applicable):**
        * If a Commander deck, identify and highlight the Commander card(s).
        * Display the Commander's color identity.
        * Identify and highlight any cards in the deck that do not conform to the Commander's color identity.
    * **Average Mana Value (MV):** Calculate and display the average mana value of all non-land cards in the deck.
    * **Format Legality Checker:** Allow users to select a format (e.g., Standard, Modern, Commander, Pioneer). The system will check the `legalities` data for each card from the local bulk data and highlight any cards that are illegal in the chosen format.

#### **"What's in my Hand" / Opening Hand Simulator** (Priority: Medium)
* **Description:** Simulates drawing a random opening hand from the imported deck.
* **Process:**
    * Take the imported decklist, where each card object is sourced from local Scryfall data.
    * Randomize the order of cards ("shuffle").
    * Display the top 7 cards (simulating an opening hand).
* **Output:** Display card images (using `image_uris.normal` or `image_uris.large` from local data) of the simulated hand.

#### **Simplified Storm Count / Spell Count Calculator** (Priority: Low)
* **Description:** Provides a basic count of cards that typically contribute to "spell count" for Storm or Prowess-like strategies.
* **Inputs:** Imported Decklist.
* **Calculations/Output:**
    * Iterate through the decklist and count cards with the "Storm" keyword or common cantrip effects (e.g., low-cost instants/sorceries that draw cards, based on parsing oracle text or type/mana cost properties from local data).
* **Integration:** Display a simple numerical count within the deck analysis section. Acknowledge this is a simplified estimate.

### 2.4 Advanced Search & Filtering

#### **Multi-Criteria Search** (Priority: High)
* **Description:** Enhance the single card search to allow users to search based on multiple criteria.
* **Inputs:** Provide distinct input fields for:
    * Card Name (partial or full)
    * Card Type (e.g., "Creature", "Instant")
    * Color Identity (e.g., "Red", "Blue/Black")
    * Keywords/Oracle Text (e.g., "draw a card", "target creature")
    * Power/Toughness
    * Converted Mana Cost (CMC/Mana Value)
* **API Integration:** Construct complex search queries using Scryfall's powerful search syntax (e.g., `q=c:red t:creature pow:3 oracle:"draw a card"`) to be sent to the Scryfall `/cards/search` API endpoint.
* **Output:** Display search results in a clear list or gallery view.

#### **Filtering Search Results by Set/Edition** (Priority: Medium)
* **Description:** Allow users to narrow down multi-criteria search results to cards from specific sets or editions.
* **Inputs:** Add a dropdown or text field for set code (e.g., "OTJ" for Outlaws of Thunder Junction) or set name.
* **API Integration:** Append the set filter to the Scryfall search query (e.g., `q=s:otj dragon`).
* **Output:** Display filtered search results.

### 2.5 User Interface Enhancements

#### **Image Gallery View** (Priority: Medium)
* **Description:** Provide an option to display cards in a grid-based image gallery view for both imported decklists and search results.
* **Implementation:** Utilize the `image_uris.normal` or `image_uris.large` from the local card data for display.

#### **Hover-over Card Details** (Priority: High)
* **Description:** When hovering over a card image, display a tooltip or pop-over with more detailed information about that card.
* **Details to Display (from local data):** Full Oracle Text, Flavor Text (if present), Artist, Collector Number, Set Name, and Format Legalities.

#### **Persistent Storage for Settings/Past Searches** (Priority: Low - desktop app specific)
* **Description:** For desktop applications, save user settings and recent search queries locally so they persist between sessions.
* **Implementation:** Use local file storage (e.g., JSON file). This does not include persistent decklists or collections.

#### **Integration with Other MTG Resources** (Priority: Low)
* **Description:** Provide convenient links to other popular MTG websites for the currently viewed card.
* **External Links:** For a given card, offer clickable links to:
    * EDHREC (for Commander players)
    * MTGGoldfish (for metagame data where applicable)
    * Gatherer (Wizards' official database)
* **Implementation:** Construct the appropriate URLs for these external sites using the card's name or Scryfall ID.

### 2.6 Combo Detection from Decklist (Priority: High)

    Description: Allows users to find known combos from the Commander Spellbook database that are present within their imported decklist.

    Inputs: The user's currently imported decklist (card names and quantities).

    Process:

        Extract Card Names: From the imported decklist, extract a unique list of all card names (ignoring quantities for the API call, as the API expects unique card names).

        API Request: Make a POST request to the Commander Spellbook API's /find-my-combos endpoint. The request body should contain a list of the card names from the deck.

            API Endpoint: https://backend.commanderspellbook.com/find-my-combos

            Method: POST

            Request Body Format (JSON):
            JSON

        {
            "cards": [
                "Sol Ring",
                "Sensei's Divining Top",
                "Future Sight",
                "Thassa's Oracle",
                "Demonic Consultation",
                "Dockside Extortionist",
                "Temur Sabertooth",
                "Cloud of Faeries"
                // ... and so on for all unique cards in the deck
            ]
        }

    Process API Response: Parse the JSON response from the Commander Spellbook API. The response will contain a list of Combo objects found within the submitted card list.

    Display Combos: Present the found combos to the user. For each combo, display:

        The name of the combo.

        The cards involved in the combo.

        A brief description of what the combo does (its "results").

        A link to the combo's page on Commander Spellbook (optional, but highly recommended for more details).

Output:

    A clear list of detected combos.

    For each combo, display the constituent cards and the combo's outcome/effect.

    Visually highlight cards in the combo that are present in the user's deck.

    If no combos are found, display an appropriate message.

## 3. Out of Scope

* **Price Data:** No functionality for fetching, displaying, or tracking card prices.
* **New Card Data (Instantaneous):** While the bulk data updates daily, immediate access to cards released *since the last bulk data update* is not guaranteed for core functionalities (API fallback mitigates this for imports/searches but not as a primary feature).
* **Specific Prints/Images:** The application will primarily use the representative image provided by the `oracle_cards` bulk data (usually the most recognizable or latest main set printing). Functionality to select or display alternative printings/artworks is out of scope.
* **Rulings Display:** No functionality to look up or display specific card rulings.
* **Wishlist/Collection Tracking (Persistent):** Allow users to "save" cards they are interested in to a local wishlist or mark cards they own in a simple collection tracker. This is explicitly *out of scope for this version* as it implies user-specific persistent data management beyond basic settings.
* **User Accounts/Authentication:** No user login or personalized data storage is planned. All data is session-based.
* **Deck Export Functionality:** Exporting modified decklists or analysis reports is not included.
* **Direct MTG Arena/MTGO Integration:** No direct API integration with game clients.
* **Print Proxy Generation:** Generating print-friendly proxies of cards is out of scope.

## 4. Technical Considerations

* **Scryfall Bulk Data Handling:** Implement robust mechanisms for:
    * Checking `updated_at` timestamps via the `/bulk-data` API endpoint.
    * Downloading and decompressing large gzipped JSON files.
    * Loading and indexing the `oracle_cards.json` into an efficient in-memory structure (e.g., a hash map for name-to-card and ID-to-card lookups).
    * Managing potential memory usage for the bulk data.
* **Scryfall API Usage (Targeted):**
    * Adhere to Scryfall's API rate limits (10 requests/sec, 75 requests burst) for the limited API calls (autocomplete, multi-criteria search, and rare fallbacks for missing cards). Implement appropriate delays or a robust queue.
    * Utilize the `/cards/autocomplete` endpoint for real-time search suggestions.
    * Utilize `/cards/search` for multi-criteria searching.
    * Utilize `/cards/named` for fallback lookup of cards not found in local bulk data.
* **Frontend Framework (if web-based):** Choose a suitable frontend framework (e.g., React, Vue, Angular) for efficient UI rendering, component management, and state management.
* **Backend (if applicable):** If a backend is used, it should primarily handle the bulk data download and potentially serve card data to the frontend, abstracting the bulk data management from the client. Direct client-side download of bulk data might be considered for simplicity but requires careful handling of large files in the browser.
* **Mathematical Libraries:** Utilize reliable libraries for hypergeometric calculations (e.g., `math.comb` in Python, or a custom implementation for JavaScript combinations).
* **Charting Libraries:** Integrate a charting library (e.g., Chart.js, D3.js for JavaScript; Matplotlib, Seaborn for Python) for mana curve and color distribution visualizations.
* **Handling the API Response:**

    The response will be a JSON array of combo objects. Each object will likely contain fields like id, name, cards, prerequisites, steps, results, color_identity, etc.

    You'll primarily be interested in name, cards (a list of objects, each with a name for the card), and results
* ** Displaying the Combos:**

    Clarity: Make it easy for the user to see the detected combos. A dedicated section or tab in the UI would be appropriate.

    Card Matching: When displaying a combo, compare the cards array from the Commander Spellbook response against the cards actually present in the user's imported deck. You might want to visually indicate which of the combo's constituent cards are indeed in the deck (e.g., green checkmark, bolding).

    Links: Provide a link back to the combo's specific page on Commander Spellbook (e.g., https://commanderspellbook.com/combo/<combo_id>) for detailed steps, explanations, and variants. The combo ID will be in the API response.

## 5. Success Metrics

* **Performance:**
    * Deck analysis (after initial bulk data load) should complete within 1-2 seconds for typical deck sizes (e.g., 100 cards).
    * Single card lookups and multi-criteria searches (after initial bulk data load) should be near-instantaneous (sub-100ms for local lookups, responsive for API calls).
    * Initial bulk data download and indexing time should be reasonable (e.g., under 30 seconds on a good connection).
* **User Engagement:** High adoption rates for deck analysis features, probability calculators, and advanced search.
* **User Feedback:** Positive feedback regarding the speed, utility, accuracy, and comprehensiveness of the tools.
* **API Error Rate:** Minimal instances of Scryfall API rate limit errors for the targeted calls.