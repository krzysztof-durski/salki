# Jak korzystać z systemu rezerwacji sal — Super Admin

Cześć! Jako Super Admin masz dostęp do wszystkich funkcji systemu. Ten dokument opisuje Twoje codzienne zadania oraz rzeczy, które tylko Ty możesz zrobić.

---

## Zaloguj się

Wejdź na stronę aplikacji i wpisz swój **adres e-mail** oraz **hasło**.

---

## Co jest tylko dla Ciebie?

Kilka rzeczy w systemie może zrobić **wyłącznie Super Admin**:

- Zakładanie kont dla Zarządu
- Dodawanie i edycja sal w systemie
- Wgląd do dziennika wszystkich działań (logów)
- Zarządzanie uprawnieniami administratorów

Reszta — zatwierdzanie rezerwacji, zarządzanie użytkownikami, podgląd kalendarza — działa tak samo jak u administratora.

---

## Dodawanie nowych użytkowników

Kliknij **„Użytkownicy"** w lewym menu, potem **„Dodaj użytkownika"**.

Wypełnij:
- Imię i nazwisko
- Adres e-mail (to będzie login)
- Tymczasowe hasło (pracownik zmieni je przy pierwszym logowaniu)
- Rolę

**Jaką rolę wybrać?**

| Rola | Dla kogo |
|------|---------|
| Biuro | Zwykły pracownik — składa prośby o sale ogólne |
| Zarząd | Osoba z zarządu — może rezerwować sale zarządu bez zatwierdzeń |
| Administrator | Osoba obsługująca rezerwacje — zatwierdza prośby, zarządza kontami |
| Super Admin | Osoba z pełnym dostępem — jak Ty |

Kliknij **„Utwórz"**. Gotowe — pracownik może się logować.

---

## Tworzenie konta dla Administratora — dodatkowe ustawienia

Gdy zakładasz konto Administratora, możesz zdecydować co ten administrator może robić:

- **Może tworzyć konta Biuro** — domyślnie tak
- **Może tworzyć konta Administrator** — domyślnie tak
- **Może tworzyć konta Zarządu** — domyślnie nie (możesz odblokować)
- **Może zarządzać salami** — domyślnie nie (możesz odblokować)

Zmieniaj te ustawienia tylko jeśli masz konkretny powód. Domyślne wartości są bezpieczne.

---

## Zarządzanie użytkownikami na co dzień

Na liście użytkowników możesz:

- **Edytować** — zmienić imię, e-mail, rolę
- **Dezaktywować** — gdy pracownik odchodzi lub jest długo nieobecny; traci dostęp, ale historia zostaje
- **Aktywować** — przywrócić dostęp dezaktywowanemu kontu
- **Zresetować hasło** — gdy ktoś zapomni hasła; przy kolejnym logowaniu ustawi nowe
- **Usunąć** — usuwa konto na stałe (nieodwracalne, używaj ostrożnie)

---

## Zarządzanie salami

Kliknij **„Sale"** w lewym menu.

### Dodanie nowej sali

1. Kliknij **„Dodaj salę"**.
2. Wpisz **nazwę** sali (np. „Sala A", „Sala Zarządu 1").
3. Wpisz **rozmiar** (np. „10 osób", „duża").
4. Wybierz **typ**:
   - **Ogólna** — dostępna dla wszystkich użytkowników
   - **Zarządu** — widoczna i dostępna tylko dla Zarządu, Administratorów i Super Admina
5. Ustaw **kolejność** (liczba — decyduje o kolejności wyświetlania na liście).
6. Kliknij **„Utwórz"**.

### Wyłączenie sali (np. remont, niedostępność)

Znajdź salę na liście i przełącz ją na **„Nieaktywna"**. Sala zniknie z listy przy tworzeniu nowych rezerwacji. Istniejące rezerwacje tej sali pozostają niezmienione.

---

## Logi — dziennik wszystkich działań

Kliknij **„Logi"** w lewym menu (widoczne tylko dla Super Admina).

Tutaj znajdziesz chronologiczny zapis wszystkich ważnych działań w systemie: kto zalogował się, kto stworzył lub usunął rezerwację, kto zmienił czyjeś konto, kto zatwierdził lub odrzucił prośbę.

Logi są **tylko do odczytu** — nie można ich zmienić ani usunąć. Wyświetlane są od najnowszych, po 50 na stronie.

Kiedy warto zajrzeć do logów:
- Gdy coś niezrozumiałego dzieje się z rezerwacją
- Gdy chcesz sprawdzić kto i kiedy coś zmienił
- Gdy pojawia się podejrzenie o nieautoryzowane działania

---

## Zatwierdzanie rezerwacji i codzienna obsługa

Działasz tak samo jak Administrator — masz dostęp do tych samych narzędzi:

- **Prośby o rezerwacje** — kolejka oczekujących próśb
- **Dzisiaj** — oś czasu rezerwacji na bieżący dzień
- **Rezerwacje** — pełna lista z filtrami

Szczegóły tych funkcji znajdziesz w instrukcji dla Administratora.

---

## Zmiana hasła

Wejdź w **Ustawienia** (ikona koła zębatego w lewym menu):

1. Wpisz **aktualne hasło**.
2. Wpisz **nowe hasło** (minimum 8 znaków).
3. Powtórz i kliknij **„Zmień hasło"**.

---

## Kilka ważnych zasad

**Dezaktywuj zamiast usuwać.** Gdy pracownik odchodzi, dezaktywuj jego konto. Usunięcie jest nieodwracalne — dezaktywacja pozwala przywrócić konto jeśli zajdzie potrzeba.

**Nie dawaj Administratorom więcej uprawnień niż potrzeba.** Flagi „może zarządzać salami" i „może tworzyć konta Zarządu" są domyślnie wyłączone z dobrych powodów.

**Hasło Super Admina chroń szczególnie.** Masz pełny dostęp do całego systemu, w tym do logów i zarządzania salami. Używaj silnego, unikalnego hasła.

**Logi są Twoim przyjacielem.** Gdy coś pójdzie nie tak lub ktoś twierdzi że „nic nie zrobił" — logi powiedzą prawdę.
