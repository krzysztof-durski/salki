# Instrukcja — Administrator

Administrator odpowiada za **codzienny nadzór nad rezerwacjami**: zatwierdza lub odrzuca prośby, zarządza użytkownikami oraz obsługuje wnioski o zmiany. Nie ma dostępu do logów audytu ani (domyślnie) do zarządzania salami.

---

## Co widzę w menu?

| Element | Ścieżka | Opis |
|---------|---------|------|
| Kalendarz | `/` | Tygodniowy widok wszystkich rezerwacji |
| Powiadomienia | `/powiadomienia` | Powiadomienia systemowe |
| Ustawienia | `/ustawienia` | Hasło, preferencje |
| **Dzisiaj** | `/admin/dzisiaj` | Harmonogram dzienny (7:00–21:00) |
| **Prośby o rezerwacje** | `/admin/rezerwacje` | Kolejka próśb wymagających zatwierdzenia *(z licznikiem)* |
| **Rezerwacje** | `/admin/panel` | Pełna lista rezerwacji z filtrami |
| **Użytkownicy** | `/admin/uzytkownicy` | Zarządzanie kontami użytkowników |
| Sale | `/admin/sale` | *Widoczne tylko jeśli Super Admin przyznał uprawnienie* |

> **Uwaga:** Logi audytu (`/admin/logi`) są **niedostępne** dla Administratora — to wyłączna funkcja Super Admina.

---

## Kalendarz (`/`)

- Widzisz **wszystkie sale** (ogólne i zarządu), przełączane **zakładkami** u góry kalendarza.
- Widzisz rezerwacje o wszystkich statusach z wyjątkiem odrzuconych.
- Kliknięcie **bloku rezerwacji** otwiera jej szczegóły.
- **Kliknięcie lub przeciągnięcie** na wolnym miejscu w kalendarzu otwiera formularz nowej rezerwacji z datą i godzinami już uzupełnionymi.
- Możesz nawigować między tygodniami strzałkami.

---

## Tworzenie rezerwacji (`/rezerwacje/nowa`)

Administrator tworzy rezerwacje **bezpośrednio** — pomijając kolejkę zatwierdzeń.

1. Kliknij **Nowa rezerwacja**.
2. Wybierz **salę** (ogólną lub zarządu).
3. Podaj **tytuł**, **datę**, **godziny** i **liczbę uczestników**.
4. Kliknij **Zapisz**.

Rezerwacja natychmiast otrzymuje status **zatwierdzona** (`approved`).

---

## Prośby o rezerwacje (`/admin/rezerwacje`) ⭐ Główna sekcja

To jest **najważniejsza sekcja codziennej pracy Administratora**. Licznik przy ikonie w menu pokazuje ile próśb czeka na decyzję.

### Sekcja 1: Prośby oczekujące (`pending`)

Lista nowych próśb o rezerwację złożonych przez Biuro i Zarząd.

#### Zatwierdzenie prośby

1. Kliknij prośbę na liście.
2. Sprawdź szczegóły: sala, termin, liczba uczestników, notatka wnioskodawcy.
3. Kliknij **Zatwierdź**.
4. Wnioskodawca otrzymuje powiadomienie o zatwierdzeniu.

> System automatycznie sprawdza konflikty terminów — nie możesz zatwierdzić rezerwacji pokrywającej się z istniejącą.

#### Odrzucenie prośby

1. Kliknij **Odrzuć**.
2. Opcjonalnie wpisz **notatkę dla wnioskodawcy** (wyjaśnienie powodu odrzucenia).
3. Wnioskodawca otrzymuje powiadomienie z notatką.

#### Kontrpropozycja

Gdy żądany termin jest zajęty, możesz zaproponować alternatywę:

1. Kliknij **Zaproponuj inny termin**.
2. Podaj alternatywną **datę**, **godzinę od** i **godzinę do**.
3. Opcjonalnie dodaj **notatkę** wyjaśniającą propozycję.
4. Kliknij **Wyślij**.

Wnioskodawca dostaje powiadomienie i może:
- **Zaakceptować** → rezerwacja zostaje zatwierdzona w nowym terminie
- **Odrzucić** → prośba zostaje odrzucona

### Sekcja 2: Wnioski o zmianę

Lista zatwierdzonych rezerwacji, dla których złożono wniosek o zmianę.

Każdy wniosek pokazuje:
- **Aktualne dane** rezerwacji (przed zmianą)
- **Wnioskowane zmiany** (nowa data/godziny/tytuł/liczba uczestników)
- **Notatkę wnioskodawcy**

#### Zatwierdzenie zmiany

Kliknij **Zatwierdź zmianę** — rezerwacja zostaje zaktualizowana do nowych danych.

#### Odrzucenie zmiany

Kliknij **Odrzuć zmianę** — rezerwacja pozostaje w oryginalnej wersji. Możesz dodać notatkę z wyjaśnieniem.

---

## Panel rezerwacji (`/admin/panel`)

Pełna lista **wszystkich** rezerwacji w systemie.

### Filtry

- **Sala** — konkretna sala lub wszystkie
- **Status** — pending / approved / rejected / counter_proposed
- **Data od / do** — zakres dat
- **Paginacja** — 20 pozycji na stronę, sortowane od najnowszej

### Dostępne akcje

| Akcja | Kiedy dostępna |
|-------|---------------|
| Podgląd | Zawsze |
| Edytuj | Zawsze |
| Usuń | Zawsze |
| Zatwierdź | Status `pending` |
| Odrzuć | Status `pending` lub `counter_proposed` |

---

## Panel „Dzisiaj" (`/admin/dzisiaj`)

Oś czasu bieżącego dnia (7:00–21:00) ze wszystkimi zarezerwowanymi salami.

- Bloki proporcjonalne do czasu trwania rezerwacji.
- Widoczne wszystkie sale i statusy (poza odrzuconymi).
- Przydatny do szybkiej weryfikacji dostępności sal w ciągu dnia.

---

## Zarządzanie użytkownikami (`/admin/uzytkownicy`)

Administrator może tworzyć i zarządzać kontami, **z wyjątkami zależnymi od uprawnień** przyznanych przez Super Admina.

### Domyślne możliwości Administratora

| Akcja | Możliwa domyślnie |
|-------|:----------------:|
| Tworzenie kont Biuro (`pracownik`) | ✓ |
| Tworzenie kont Administrator (`admin`) | ✓ |
| Tworzenie kont Zarząd (`zarzad`) | ✗ |
| Tworzenie kont Super Admin | ✗ |

> Super Admin może odblokować tworzenie kont Zarząd dla konkretnego Administratora (flaga `admin_can_assign_zarzad`).

### Tworzenie nowego użytkownika

1. Kliknij **Dodaj użytkownika**.
2. Wypełnij imię i nazwisko, e-mail, hasło tymczasowe, rolę.
3. Kliknij **Utwórz**.

Użytkownik przy pierwszym logowaniu zostanie poproszony o zmianę hasła.

### Edycja użytkownika

Kliknij użytkownika i wybierz **Edytuj**. Możesz zmienić imię, e-mail, rolę, status aktywności.

> **Ważne ograniczenie:** Administrator **nie może edytować ani dezaktywować kont Super Admina**.

### Reset hasła

Kliknij **Reset hasła** przy wybranym koncie. Użytkownik przy następnym logowaniu będzie musiał ustawić nowe hasło.

### Dezaktywacja / Aktywacja konta

Przełącz status na **nieaktywny**, aby zablokować dostęp bez usuwania konta. Przydatne gdy pracownik jest chwilowo nieobecny lub odchodzi.

### Usunięcie konta

Kliknij **Usuń** i potwierdź. Operacja **nieodwracalna**.

---

## Zarządzanie salami (`/admin/sale`)

Dostępne **tylko gdy Super Admin przyznał uprawnienie** `admin_can_manage_rooms`.

Jeśli masz to uprawnienie, możesz:
- Dodawać nowe sale (ogólne i zarządu)
- Edytować nazwy i rozmiary istniejących sal
- Dezaktywować/aktywować sale

Jeśli nie widzisz tej opcji w menu, skontaktuj się z Super Adminem.

---

## Ustawienia (`/ustawienia`)

| Opcja | Opis |
|-------|------|
| Zmiana hasła | Wpisz aktualne, potem nowe (min. 8 znaków) i potwierdzenie |
| Preferowana sala | Domyślnie wybrana przy tworzeniu nowej rezerwacji |

---

## Jak widzę rezerwacje innych użytkowników?

Administrator widzi **wszystkie rezerwacje** we wszystkich salach. W szczegółach rezerwacji widoczne jest:
- Kto złożył prośbę (imię, rola)
- Notatka wnioskodawcy
- Historia zmian (przy wnioskach o zmianę)
- Pola zmodyfikowane przez Zarząd (przy edycjach sal zarządu)

---

## Rezerwacje Zarządu — co warto wiedzieć

Zarząd może samodzielnie edytować swoje zatwierdzone rezerwacje sal zarządu **bez wymaganego zatwierdzenia**. Gdy Zarząd dokona zmian:

- Dostaniesz powiadomienie w aplikacji.
- W szczegółach rezerwacji zobaczysz **które pola zostały zmienione** i jakie były oryginalne wartości.
- Zmiana jest już obowiązująca — nie musisz jej zatwierdzać.

---

## Najczęstsze scenariusze

### Scenariusz 1: Dwie osoby chcą tę samą salę w tym samym czasie

1. Pierwsza prośba przychodzi do kolejki — zatwierdź ją.
2. Druga prośba — sprawdź konflikt. Odrzuć lub zaproponuj kontrpropozycję w innym terminie.

### Scenariusz 2: Użytkownik prosi o zmianę zatwierdzonej rezerwacji

1. W sekcji **Wnioski o zmianę** widzisz prośbę z porównaniem starych i nowych danych.
2. Sprawdź czy nowy termin jest wolny.
3. Zatwierdź lub odrzuć zmianę.

### Scenariusz 3: Pracownik odchodzi z firmy

1. Przejdź do `/admin/uzytkownicy`.
2. Znajdź konto pracownika.
3. Kliknij **Dezaktywuj** — pracownik traci dostęp, jego rezerwacje pozostają w systemie.

### Scenariusz 4: Ktoś zapomniał hasła

1. Przejdź do `/admin/uzytkownicy`.
2. Znajdź konto użytkownika.
3. Kliknij **Reset hasła** — użytkownik przy następnym logowaniu ustawi nowe hasło.
