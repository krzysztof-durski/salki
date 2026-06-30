# Instrukcja — Super Admin

Super Admin posiada **pełen dostęp** do wszystkich funkcji systemu. Jest to jedyna rola, która ma wgląd do logów audytu i może zarządzać kontami o roli Zarząd.

---

## Co widzę w menu?

Po zalogowaniu widoczne jest pełne menu boczne:

| Element | Ścieżka | Opis |
|---------|---------|------|
| Kalendarz | `/` | Tygodniowy widok wszystkich rezerwacji |
| Powiadomienia | `/powiadomienia` | Powiadomienia systemowe |
| Ustawienia | `/ustawienia` | Hasło, preferencje |
| **Dzisiaj** | `/admin/dzisiaj` | Harmonogram dzienny (7:00–21:00) |
| **Prośby o rezerwacje** | `/admin/rezerwacje` | Kolejka próśb do zatwierdzenia |
| **Rezerwacje** | `/admin/panel` | Pełna lista rezerwacji z filtrami |
| **Użytkownicy** | `/admin/uzytkownicy` | Zarządzanie wszystkimi kontami |
| **Sale** | `/admin/sale` | Zarządzanie salami konferencyjnymi |
| **Logi** | `/admin/logi` | Dziennik audytu — tylko dla Super Admina |

---

## Kalendarz (`/`)

- Widzisz **wszystkie sale** (ogólne i zarządu), przełączane **zakładkami** u góry kalendarza.
- Widzisz rezerwacje o **każdym statusie** z wyjątkiem odrzuconych (pending, approved, counter_proposed).
- Kliknięcie **bloku rezerwacji** otwiera jej szczegóły.
- **Kliknięcie lub przeciągnięcie** na wolnym miejscu w kalendarzu otwiera formularz nowej rezerwacji z datą i godzinami już uzupełnionymi.
- Możesz przechodzić między tygodniami za pomocą strzałek.

---

## Tworzenie rezerwacji (`/rezerwacje/nowa`)

Jako Super Admin tworzysz rezerwacje **bezpośrednio** — pomijasz kolejkę zatwierdzeń.

1. Kliknij przycisk **Nowa rezerwacja** (widoczny w kalendarzu lub przez ręczne wpisanie adresu).
2. Wybierz **salę** (dostępne są wszystkie sale ogólne i zarządu).
3. Podaj **tytuł** rezerwacji.
4. Wybierz **datę**, **godzinę rozpoczęcia** i **godzinę zakończenia**.
5. Wpisz **liczbę uczestników**.
6. Kliknij **Zapisz**.

Rezerwacja natychmiast otrzymuje status **zatwierdzona** (`approved`) — nie przechodzi przez kolejkę próśb.

---

## Panel „Dzisiaj" (`/admin/dzisiaj`)

Oś czasu wszystkich rezerwacji na bieżący dzień w godzinach **7:00–21:00**.

- Bloki są rozmieszczone proporcjonalnie do czasu trwania rezerwacji.
- Widoczne są wszystkie sale i wszystkie statusy (poza odrzuconymi).
- Przydatny do szybkiego podglądu dnia roboczego.

---

## Prośby o rezerwacje (`/admin/rezerwacje`)

Kolejka próśb wymagających decyzji:

### Sekcja 1: Prośby oczekujące

Lista rezerwacji ze statusem `pending`. Dla każdej prośby możesz:

| Akcja | Opis |
|-------|------|
| **Zatwierdź** | Rezerwacja zostaje zatwierdzona; wnioskodawca dostaje powiadomienie |
| **Odrzuć** | Podaj opcjonalną notatkę; wnioskodawca dostaje powiadomienie |
| **Zaproponuj inny termin** | Podaj alternatywną datę/godzinę; wnioskodawca może zaakceptować lub odrzucić |

### Sekcja 2: Wnioski o zmianę

Lista zatwierdzonych rezerwacji, dla których złożono wniosek o zmianę terminu lub szczegółów. Dla każdego wniosku możesz:

| Akcja | Opis |
|-------|------|
| **Zatwierdź zmianę** | Rezerwacja zostaje zaktualizowana do nowych danych |
| **Odrzuć zmianę** | Rezerwacja pozostaje bez zmian |

---

## Panel rezerwacji (`/admin/panel`)

Pełna lista **wszystkich** rezerwacji w systemie z zaawansowanymi filtrami.

### Filtry

- **Sala** — wybierz konkretną salę lub „wszystkie"
- **Status** — pending / approved / rejected / counter_proposed
- **Data od / do** — zakres dat
- **Paginacja** — 20 pozycji na stronę

### Dostępne akcje na każdej rezerwacji

| Akcja | Opis |
|-------|------|
| Podgląd szczegółów | Kliknij rezerwację, aby zobaczyć pełne informacje |
| Edytuj | Zmień tytuł, datę, godziny, liczbę uczestników |
| Usuń | Usuń rezerwację (nieodwracalne) |
| Zatwierdź / Odrzuć | Dostępne dla statusów `pending` i `counter_proposed` |

---

## Zarządzanie użytkownikami (`/admin/uzytkownicy`)

Super Admin może tworzyć i zarządzać kontami **wszystkich ról** (Biuro, Zarząd, Administrator, Super Admin).

### Tworzenie nowego użytkownika

1. Kliknij **Dodaj użytkownika**.
2. Wypełnij:
   - **Imię i nazwisko**
   - **Adres e-mail** (używany do logowania)
   - **Hasło tymczasowe** (użytkownik musi je zmienić przy pierwszym logowaniu)
   - **Rola**: `pracownik` / `zarzad` / `admin` / `super_admin`
3. Kliknij **Utwórz**.

Użytkownik przy pierwszym logowaniu zostanie poproszony o zmianę hasła.

### Edycja użytkownika

Kliknij użytkownika na liście i wybierz **Edytuj**. Możesz zmienić:
- Imię i nazwisko
- Adres e-mail
- Rolę
- Status aktywności (aktywny / nieaktywny)

### Granularne uprawnienia Administratorów

Gdy tworzysz lub edytujesz konto Administratora, możesz ustawić dodatkowe flagi:

| Flaga | Domyślnie | Opis |
|-------|:---------:|------|
| Może przypisywać rolę Admin | ✓ | Administrator może tworzyć inne konta Admin |
| Może przypisywać rolę Zarząd | ✗ | Administrator może tworzyć konta Zarząd |
| Może przypisywać rolę Pracownik | ✓ | Administrator może tworzyć konta Biuro |
| Może zarządzać salami | ✗ | Administrator ma dostęp do `/admin/sale` |

> **Ważne:** Flagi te pozwalają delegować uprawnienia bez nadawania roli Super Admina. Ostrożnie je ustawiaj.

### Reset hasła

Na liście użytkowników kliknij **Reset hasła** przy wybranym koncie. System wymusi zmianę hasła przy następnym logowaniu.

### Dezaktywacja konta

Kliknij **Dezaktywuj** aby zablokować dostęp do konta bez jego usuwania. Dezaktywowany użytkownik nie może się zalogować. Konto można ponownie aktywować w każdej chwili.

### Usunięcie użytkownika

Kliknij **Usuń** i potwierdź. Operacja jest **nieodwracalna**. Rezerwacje powiązane z użytkownikiem pozostają w systemie.

---

## Zarządzanie salami (`/admin/sale`)

Tylko Super Admin i Administratorzy z flagą `admin_can_manage_rooms` mają dostęp do tej sekcji.

### Tworzenie sali

1. Kliknij **Dodaj salę**.
2. Wypełnij:
   - **Nazwa sali** (np. „Sala A", „Sala Zarządu 1")
   - **Rozmiar** (etykieta, np. „10 osób", „duża")
   - **Kategoria**: `general` (ogólna) lub `board` (zarządu)
   - **Kolejność sortowania** (liczba — decyduje o kolejności na liście i w kalendarzu)
3. Kliknij **Utwórz**.

### Edycja sali

Kliknij salę na liście i zmień jej dane.

### Dezaktywacja sali

Przełącz status sali na **nieaktywna**. Nieaktywna sala:
- Nie pojawia się przy tworzeniu nowych rezerwacji.
- Istniejące rezerwacje tej sali pozostają widoczne.

> **Uwaga:** Nie można usunąć sali, która ma przypisane rezerwacje. Dezaktywacja jest bezpieczniejszą alternatywą.

---

## Logi audytu (`/admin/logi`)

Tylko Super Admin ma dostęp do dziennika audytu. Rejestruje on **wszystkie kluczowe akcje** w systemie.

### Co jest logowane?

- Tworzenie, edycja i usuwanie rezerwacji
- Zatwierdzanie i odrzucanie próśb
- Tworzenie, edycja, dezaktywacja i usuwanie kont użytkowników
- Resety haseł
- Logowania i wylogowania
- Modyfikacje dokonane przez Zarząd

### Informacje w każdym wpisie

| Pole | Opis |
|------|------|
| Data i czas | Kiedy akcja miała miejsce |
| Użytkownik | Kto wykonał akcję |
| Akcja | Typ działania (np. `booking_approved`) |
| Obiekt | Czego dotyczyła akcja (np. rezerwacja #42) |
| Szczegóły | Dodatkowe dane (stary/nowy status, zmiany pól) |
| Adres IP | Skąd wykonano akcję |

- Logi są **tylko do odczytu** — nie można ich modyfikować ani usuwać.
- Wyświetlane po 50 wpisów na stronę, sortowane od najnowszych.

---

## Ustawienia (`/ustawienia`)

| Opcja | Opis |
|-------|------|
| Zmiana hasła | Wpisz aktualne hasło, potem nowe (min. 8 znaków) i potwierdzenie |
| Preferowana sala | Sala domyślnie wybrana przy tworzeniu rezerwacji |

---

## Przegląd szczegółów rezerwacji (`/rezerwacje/:id`)

Klikając dowolną rezerwację (z kalendarza lub panelu admin) widzisz:

- Sala, tytuł, data, godziny, liczba uczestników
- Status i historia zmian
- Notatka wnioskodawcy i notatka administratora
- Przy kontrpropozycji: proponowany alternatywny termin
- Przy wniosku o zmianę: stare i nowe wartości pól
- Dostępne akcje (zatwierdź, odrzuć, edytuj, usuń — w zależności od statusu)

---

## Podsumowanie — czego Super Admin nie może stracić z oczu

1. **Granularne flagi Administratorów** — upewnij się, że Admin nie ma uprawnień, których nie powinien mieć (`admin_can_assign_zarzad`, `admin_can_manage_rooms`).
2. **Logi audytu** — regularnie sprawdzaj podejrzane akcje.
3. **Dezaktywacja kont** zamiast usuwania — bezpieczniejsza opcja, gdy pracownik odchodzi.
4. **Sale zarządu** — tylko Zarząd, Admin i Super Admin je widzą. Konta Biuro nie mają do nich dostępu.
