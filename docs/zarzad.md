# Instrukcja — Zarząd

Rola Zarząd umożliwia korzystanie zarówno z **sal ogólnych**, jak i z **sal zarządu**. Rezerwacje sal zarządu możesz edytować bezpośrednio — bez konieczności czekania na zatwierdzenie. Prośby o sale ogólne wymagają zatwierdzenia przez Administratora.

---

## Co widzę w menu?

| Element | Ścieżka | Opis |
|---------|---------|------|
| Kalendarz | `/` | Tygodniowy widok rezerwacji — sale ogólne + zarządu |
| Powiadomienia | `/powiadomienia` | Powiadomienia o statusach Twoich rezerwacji |
| Ustawienia | `/ustawienia` | Zmiana hasła, preferowana sala |

> Zarząd **nie ma dostępu** do panelu administracyjnego (Dzisiaj, Prośby, Panel rezerwacji, Użytkownicy, Sale, Logi).

---

## Kalendarz (`/`)

- Widzisz **sale ogólne i sale zarządu**.
- Widoczne są rezerwacje **zatwierdzone** wszystkich użytkowników (nie widzisz cudzych oczekujących próśb).
- Widzisz **własne** rezerwacje o statusach: oczekuje, zatwierdzona, kontrpropozycja.
- Kliknięcie bloku rezerwacji otwiera jej szczegóły.
- Nawigujesz między tygodniami strzałkami nawigacyjnymi.

---

## Tworzenie rezerwacji (`/rezerwacje/nowa`)

1. Kliknij przycisk **Nowa rezerwacja** w kalendarzu.
2. Wybierz **salę**:
   - **Sale ogólne** — Twoja prośba trafi do kolejki i wymaga zatwierdzenia przez Administratora.
   - **Sale zarządu** — rezerwacja zostanie **od razu zatwierdzona**.
3. Wypełnij formularz:
   - **Tytuł** — krótki opis spotkania
   - **Data** — dzień rezerwacji
   - **Godzina od / do** — czas trwania spotkania
   - **Liczba uczestników**
   - **Notatka** *(opcjonalnie)* — dodatkowe informacje dla administratora
4. Kliknij **Zapisz**.

### Różnica między salami ogólnymi a salami zarządu

| | Sala ogólna | Sala zarządu |
|-|:-----------:|:------------:|
| Rezerwacja od razu zatwierdzona | ✗ | ✓ |
| Wymaga zatwierdzenia admina | ✓ | ✗ |
| Możliwość edycji bez zatwierdzenia | ✗ | ✓ |
| Widoczność w kalendarzu (Biuro) | ✓ | ✗ |

---

## Moje rezerwacje i ich statusy

Wszystkie swoje rezerwacje możesz zobaczyć w kalendarzu lub klikając w konkretną rezerwację.

### Statusy rezerwacji sal ogólnych

| Status | Co oznacza | Co możesz zrobić |
|--------|-----------|-----------------|
| `oczekuje` | Prośba złożona, czeka na decyzję admina | Edytuj lub anuluj prośbę |
| `zatwierdzona` | Sala potwierdzona, rezerwacja obowiązuje | Wniosek o zmianę |
| `odrzucona` | Prośba nie została przyjęta | Złóż nową prośbę |
| `kontrpropozycja` | Admin zaproponował inny termin | Zaakceptuj lub odrzuć kontrpropozycję |

### Statusy rezerwacji sal zarządu

| Status | Co oznacza | Co możesz zrobić |
|--------|-----------|-----------------|
| `zatwierdzona` | Rezerwacja aktywna | Edytuj bezpośrednio lub usuń |

---

## Edycja prośby oczekującej (sala ogólna)

Dopóki Administrator nie podjął decyzji o Twojej prośbie (status `oczekuje`), możesz ją edytować:

1. Kliknij rezerwację w kalendarzu.
2. Kliknij **Edytuj**.
3. Zmień dane i kliknij **Zapisz**.

Po edycji prośba nadal oczekuje na zatwierdzenie.

---

## Anulowanie prośby (sala ogólna)

1. Kliknij rezerwację w kalendarzu.
2. Kliknij **Usuń**.
3. Potwierdź usunięcie.

> Możesz anulować tylko własne rezerwacje. Raz usuniętej rezerwacji nie można przywrócić.

---

## Kontrpropozycja od Administratora

Gdy Administrator zaproponuje alternatywny termin (status `kontrpropozycja`):

1. Otrzymasz **powiadomienie** w aplikacji.
2. Kliknij powiadomienie lub znajdź rezerwację w kalendarzu.
3. W szczegółach zobaczysz:
   - Oryginalnie wnioskowany termin
   - Proponowany przez admina nowy termin
   - Opcjonalną notatkę admina
4. Podjmij decyzję:
   - **Zaakceptuj** → rezerwacja zostaje zatwierdzona w nowym terminie
   - **Odrzuć** → prośba zostaje odrzucona

---

## Edycja zatwierdzonej rezerwacji sali zarządu ⭐

To jest kluczowa różnica roli Zarząd — możesz **bezpośrednio edytować** swoje zatwierdzone rezerwacje sal zarządu bez konieczności czekania na zatwierdzenie admina.

1. Kliknij rezerwację sali zarządu w kalendarzu.
2. Kliknij **Edytuj**.
3. Zmień potrzebne dane (data, godziny, tytuł, liczba uczestników).
4. Kliknij **Zapisz**.

Zmiany wchodzą w życie **natychmiast**.

> Administrator zostaje automatycznie powiadomiony o Twojej edycji. W systemie zapisywana jest historia zmian — administrator widzi jakie pola zostały zmodyfikowane i jakie były poprzednie wartości.

---

## Wniosek o zmianę zatwierdzonej rezerwacji (sala ogólna)

Gdy chcesz zmienić szczegóły **zatwierdzonej** rezerwacji sali ogólnej, musisz złożyć wniosek o zmianę:

1. Kliknij zatwierdzoną rezerwację w kalendarzu.
2. Kliknij **Wnioskuj o zmianę**.
3. Podaj **nowe dane** (zmień tylko te pola, które chcesz zmodyfikować).
4. Opcjonalnie dodaj **notatkę** z wyjaśnieniem powodu zmiany.
5. Kliknij **Wyślij wniosek**.

Administrator przejrzy Twój wniosek i zatwierdzi lub odrzuci zmianę. Dostaniesz powiadomienie o decyzji.

---

## Powiadomienia (`/powiadomienia`)

Kliknij ikonę dzwonka w menu lub przejdź do `/powiadomienia`.

Liczba przy ikonie to liczba **nieprzeczytanych** powiadomień.

### Jakie powiadomienia otrzymujesz?

| Zdarzenie | Powiadomienie |
|-----------|--------------|
| Admin zatwierdził prośbę | Rezerwacja zatwierdzona |
| Admin odrzucił prośbę | Rezerwacja odrzucona (z notatką jeśli dodał) |
| Admin zaproponował kontrpropozycję | Kontrpropozycja — sprawdź szczegóły |
| Admin zatwierdził wniosek o zmianę | Zmiana zatwierdzona |
| Admin odrzucił wniosek o zmianę | Zmiana odrzucona |

---

## Ustawienia (`/ustawienia`)

| Opcja | Opis |
|-------|------|
| Zmiana hasła | Wpisz aktualne hasło, potem nowe (min. 8 znaków) i potwierdzenie |
| Preferowana sala | Sala domyślnie wybrana przy tworzeniu nowej rezerwacji |

---

## Najczęstsze pytania

### Czy mogę zarezerwować salę zarządu dla innych osób?

Tak — wpisz tytuł spotkania, datę i godziny. Rezerwacja jest przypisana do Twojego konta, ale możesz podać w tytule nazwę spotkania lub uczestników.

### Czy Biuro widzi moje rezerwacje w sali zarządu?

Nie. Sale zarządu są **niewidoczne** dla użytkowników z rolą Biuro. Widzą je tylko Zarząd, Administratorzy i Super Admin.

### Co się stanie jeśli moja prośba o salę ogólną nie zostanie rozpatrzona szybko?

Możesz skontaktować się z Administratorem lub sprawdzić powiadomienia — będziesz informowany na bieżąco o każdej decyzji.

### Czy mogę usunąć zatwierdzoną rezerwację?

Tak — kliknij rezerwację i wybierz **Usuń**. Dotyczy to zarówno sal ogólnych jak i zarządu. Pamiętaj, że usunięcia nie można cofnąć.

### Administrator zaproponował mi inny termin, ale on mi nie odpowiada — co zrobić?

Odrzuć kontrpropozycję i złóż nową prośbę z inną datą. Możesz też skontaktować się bezpośrednio z administratorem.
