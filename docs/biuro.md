# Instrukcja — Biuro (Pracownik)

Rola Biuro umożliwia **składanie próśb o rezerwację sal ogólnych**. Każda prośba wymaga zatwierdzenia przez Administratora. Nie masz dostępu do sal zarządu ani do funkcji administracyjnych.

---

## Co widzę w menu?

| Element | Ścieżka | Opis |
|---------|---------|------|
| Kalendarz | `/` | Tygodniowy widok rezerwacji sal ogólnych |
| Powiadomienia | `/powiadomienia` | Powiadomienia o statusach Twoich rezerwacji |
| Ustawienia | `/ustawienia` | Zmiana hasła, preferowana sala |

> Biuro **nie ma dostępu** do sal zarządu, panelu administracyjnego, listy użytkowników ani logów.

---

## Pierwsze logowanie

Przy pierwszym logowaniu system wymusi zmianę hasła:

1. Wpisz **tymczasowe hasło** otrzymane od administratora.
2. Wpisz **nowe hasło** (minimum 8 znaków).
3. Powtórz nowe hasło w polu potwierdzenia.
4. Kliknij **Zmień hasło**.

Od tej chwili logujesz się nowym hasłem.

---

## Kalendarz (`/`)

Strona główna to **tygodniowy widok kalendarza**.

- Widzisz tylko **sale ogólne** (sale zarządu są dla Ciebie niewidoczne).
- Widzisz **zatwierdzone** rezerwacje wszystkich użytkowników — żebyś wiedział kiedy sala jest zajęta.
- Widzisz **własne** rezerwacje o statusach: oczekuje, zatwierdzona, kontrpropozycja.
- **Nie widzisz** oczekujących próśb innych użytkowników.
- Kliknięcie bloku rezerwacji otwiera jej szczegóły.
- Strzałki nawigacyjne przełączają między tygodniami.

---

## Jak zarezerwować salę? (`/rezerwacje/nowa`)

1. Kliknij przycisk **Nowa rezerwacja** na stronie kalendarza.
2. Wypełnij formularz:

   | Pole | Opis |
   |------|------|
   | Sala | Wybierz z listy dostępnych sal ogólnych |
   | Tytuł | Krótki opis spotkania (np. „Spotkanie zespołu", „Szkolenie") |
   | Data | Dzień rezerwacji |
   | Godzina od | Godzina rozpoczęcia |
   | Godzina do | Godzina zakończenia |
   | Liczba uczestników | Ile osób będzie uczestniczyć |
   | Notatka | *(opcjonalnie)* Dodatkowe informacje dla administratora |

3. Kliknij **Wyślij prośbę**.

Twoja prośba trafia do kolejki — status: **oczekuje** (`pending`).

> **Ważne:** Sam fakt złożenia prośby **nie rezerwuje** sali. Sala jest zajęta dopiero po zatwierdzeniu przez Administratora.

---

## Statusy Twoich rezerwacji

| Status | Co oznacza | Co możesz zrobić |
|--------|-----------|-----------------|
| `oczekuje` | Prośba złożona, Administrator jeszcze nie podjął decyzji | Edytuj lub anuluj |
| `zatwierdzona` | Sala potwierdzona, rezerwacja obowiązuje | Wniosek o zmianę lub usuń |
| `odrzucona` | Prośba nie została przyjęta | Złóż nową prośbę |
| `kontrpropozycja` | Administrator zaproponował inny termin | Zaakceptuj lub odrzuć |

---

## Edycja prośby oczekującej

Dopóki Administrator nie podjął decyzji (status `oczekuje`), możesz zmienić szczegóły prośby:

1. Kliknij rezerwację w kalendarzu.
2. Kliknij **Edytuj**.
3. Zmień potrzebne dane.
4. Kliknij **Zapisz**.

Prośba nadal oczekuje na decyzję (nie zaczyna się od nowa).

---

## Anulowanie prośby

Jeśli chcesz wycofać prośbę (status `oczekuje`) lub usunąć zatwierdzoną rezerwację:

1. Kliknij rezerwację w kalendarzu.
2. Kliknij **Usuń**.
3. Potwierdź w oknie dialogowym.

> Usunięcia nie można cofnąć. Rezerwacja znika z systemu.

---

## Kontrpropozycja od Administratora

Gdy żądany przez Ciebie termin jest zajęty, Administrator może zaproponować **inny termin** — status zmienia się na `kontrpropozycja`.

1. Otrzymasz **powiadomienie** w aplikacji (ikona dzwonka).
2. Kliknij powiadomienie lub znajdź rezerwację w kalendarzu.
3. W szczegółach zobaczysz:
   - Twój oryginalny termin
   - Proponowany przez admina nowy termin
   - Opcjonalną notatkę admina z wyjaśnieniem
4. Podjmij decyzję:

   | Akcja | Efekt |
   |-------|-------|
   | **Zaakceptuj** | Rezerwacja zostaje zatwierdzona w nowym terminie |
   | **Odrzuć** | Prośba zostaje odrzucona — możesz złożyć nową |

---

## Wniosek o zmianę zatwierdzonej rezerwacji

Gdy chcesz zmienić szczegóły **zatwierdzonej** rezerwacji (np. przesunąć godzinę lub zmienić salę), musisz złożyć wniosek o zmianę:

1. Kliknij zatwierdzoną rezerwację w kalendarzu.
2. Kliknij **Wnioskuj o zmianę**.
3. Podaj nowe dane — zmień tylko te pola, które chcesz zmodyfikować:
   - Nowa data
   - Nowe godziny od/do
   - Nowy tytuł
   - Nowa liczba uczestników
4. Dodaj opcjonalną **notatkę** z wyjaśnieniem.
5. Kliknij **Wyślij wniosek**.

Administrator przejrzy wniosek i zatwierdzi lub odrzuci zmianę. Dostaniesz powiadomienie o decyzji.

> Dopóki wniosek czeka na decyzję, rezerwacja działa w **starym terminie**. Wniosek o zmianę nie blokuje rezerwacji.

---

## Powiadomienia (`/powiadomienia`)

Kliknij ikonę dzwonka w menu bocznym lub przejdź do `/powiadomienia`.

Liczba przy ikonie dzwonka = liczba **nieprzeczytanych** powiadomień.

### Jakie powiadomienia otrzymujesz?

| Zdarzenie | Co zobaczysz |
|-----------|-------------|
| Administrator zatwierdził prośbę | „Twoja rezerwacja została zatwierdzona" |
| Administrator odrzucił prośbę | „Twoja rezerwacja została odrzucona" + ewentualna notatka |
| Administrator zaproponował kontrpropozycję | „Administrator zaproponował inny termin — sprawdź szczegóły" |
| Administrator zatwierdził wniosek o zmianę | „Zmiana rezerwacji została zatwierdzona" |
| Administrator odrzucił wniosek o zmianę | „Zmiana rezerwacji została odrzucona" |

Kliknięcie powiadomienia przenosi Cię bezpośrednio do szczegółów danej rezerwacji.

---

## Ustawienia (`/ustawienia`)

### Zmiana hasła

1. Wpisz **aktualne hasło**.
2. Wpisz **nowe hasło** (minimum 8 znaków).
3. Wpisz nowe hasło jeszcze raz w polu **Potwierdź hasło**.
4. Kliknij **Zmień hasło**.

### Preferowana sala

Wybierz salę, która będzie domyślnie zaznaczona przy tworzeniu nowej rezerwacji. Przydatne jeśli zazwyczaj rezerwujesz tę samą salę.

---

## Najczęstsze pytania

### Dlaczego nie mogę zobaczyć sali zarządu?

Sale zarządu są dostępne **wyłącznie** dla użytkowników z rolą Zarząd, Administrator i Super Admin. Jeśli potrzebujesz zarezerwować salę zarządu, skontaktuj się bezpośrednio z Administratorem.

### Złożyłem prośbę — kiedy dostanę odpowiedź?

Czas odpowiedzi zależy od dostępności administratora. Możesz śledzić status w kalendarzu — Twoja prośba pojawi się jako blok ze statusem `oczekuje`.

### Administrator odrzucił moją prośbę. Co teraz?

Sprawdź notatkę admina (jeśli dodał) — wyjaśnia powód odrzucenia. Możesz:
- Złożyć nową prośbę na inny termin.
- Skontaktować się z Administratorem bezpośrednio.

### Chcę zmienić godzinę zatwierdzonej rezerwacji

Użyj **wniosku o zmianę** — kliknij rezerwację i wybierz „Wnioskuj o zmianę". Administrator rozpatrzy wniosek. Do czasu decyzji rezerwacja działa w starym terminie.

### Czy inne osoby z Biura widzą moją prośbę (status `oczekuje`)?

Nie. W kalendarzu inne osoby z Biura widzą tylko **zatwierdzone** rezerwacje. Twoje oczekujące prośby widoczne są tylko dla Ciebie (oraz dla Administratorów).

### Zatwierdzono moją rezerwację, ale teraz jej nie potrzebuję

Kliknij rezerwację i wybierz **Usuń**. Pamiętaj, żeby to zrobić możliwie wcześnie, żeby sala była dostępna dla innych.

### Mogę mieć kilka aktywnych rezerwacji naraz?

Tak — możesz mieć wiele próśb i zatwierdzeń jednocześnie, w różnych salach i terminach. System nie ogranicza liczby rezerwacji.

---

## Czego Biuro nie może robić?

| Akcja | Dostępna |
|-------|:--------:|
| Rezerwacja bezpośrednia (bez zatwierdzenia) | ✗ |
| Dostęp do sal zarządu | ✗ |
| Podgląd cudzych oczekujących próśb | ✗ |
| Zatwierdzanie rezerwacji | ✗ |
| Zarządzanie użytkownikami | ✗ |
| Zarządzanie salami | ✗ |
| Logi audytu | ✗ |
