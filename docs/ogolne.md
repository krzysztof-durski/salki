# Ogólny opis systemu — Lafrentz Rezerwacja Sal

## Czym jest ten system?

**Lafrentz Salki** to aplikacja webowa do rezerwacji sal konferencyjnych i sal zarządu. System zarządza kolejką rezerwacji, procesem zatwierdzeń, powiadomieniami i historią zmian.

---

## Jak się zalogować?

1. Otwórz aplikację w przeglądarce.
2. Wpisz **adres e-mail** i **hasło** przydzielone przez administratora.
3. Kliknij **Zaloguj się**.

> **Pierwsze logowanie:** Przy pierwszym zalogowaniu system wymusi zmianę hasła. Wprowadź nowe hasło (minimum 8 znaków) i potwierdź je.

Sesja logowania trwa **24 godziny**. Po upływie tego czasu zostaniesz automatycznie wylogowany.

---

## Nawigacja — pasek boczny

Po zalogowaniu widoczny jest pasek boczny z menu. Elementy menu zależą od Twojej roli:

| Element menu | Ikona | Kto widzi | Opis |
|-------------|-------|-----------|------|
| Kalendarz | 📅 | Wszyscy | Tygodniowy widok rezerwacji |
| Powiadomienia | 🔔 | Wszyscy | Lista powiadomień (z licznikiem nieprzeczytanych) |
| Ustawienia | ⚙️ | Wszyscy | Zmiana hasła, preferencje sali |
| Dzisiaj | 📋 | Admin+ | Harmonogram rezerwacji na dziś (7:00–21:00) |
| Prośby o rezerwacje | 📨 | Admin+ | Kolejka próśb wymagających zatwierdzenia |
| Rezerwacje | 📊 | Admin+ | Pełna lista wszystkich rezerwacji z filtrami |
| Użytkownicy | 👥 | Admin+ | Zarządzanie kontami użytkowników |
| Sale | 🏢 | Super Admin / uprawniony Admin | Zarządzanie salami |
| Logi | 📝 | Super Admin | Dziennik audytu wszystkich działań |

---

## Kalendarz — widok tygodniowy

Strona główna (`/`) to **tygodniowy kalendarz** rezerwacji.

- Pokazuje rezerwacje od **poniedziałku do niedzieli**.
- Używając strzałek nawigujesz między tygodniami.
- Każda rezerwacja widoczna jest jako blok z nazwą sali, tytułem i godziną.
- Klikając **blok rezerwacji** przejdziesz do jej szczegółów.
- **Biuro** widzi tylko sale ogólne. **Zarząd, Admin, Super Admin** widzą także sale zarządu.

### Zakładki sal

Na górze kalendarza widoczne są **zakładki** — jedna na każdą salę. Kalendarz pokazuje zawsze jedną salę na raz. Kliknij zakładkę żeby przełączyć się na inną salę.

### Szybkie tworzenie rezerwacji z kalendarza

Zamiast klikać „Nowa rezerwacja" i ręcznie wybierać godziny, możesz kliknąć bezpośrednio na kalendarzu:

- **Kliknięcie** na wolny slot — otwiera formularz nowej rezerwacji z datą i godziną już uzupełnioną.
- **Przeciągnięcie** po kilku slotach — zaznacza zakres czasu, formularz otwiera się z uzupełnionym przedziałem od–do.

Formularz otworzy się z wybraną salą (aktywna zakładka), datą i godzinami — wystarczy dodać tytuł i potwierdzić.

### Co widać w kalendarzu?

| Rola | Widoczne rezerwacje |
|------|-------------------|
| Biuro | Zatwierdzone (wszystkich) + własne oczekujące/kontrpropozycje w salach ogólnych |
| Zarząd | Zatwierdzone (wszystkich) + własne oczekujące/kontrpropozycje w salach ogólnych i zarządu |
| Administrator | Wszystkie (poza odrzuconymi) we wszystkich salach |
| Super Admin | Wszystkie (poza odrzuconymi) we wszystkich salach |

---

## Statusy rezerwacji

Każda rezerwacja posiada jeden z poniższych statusów:

| Status | Polska nazwa | Opis |
|--------|-------------|------|
| `pending` | Oczekuje | Prośba złożona, czeka na decyzję administratora |
| `approved` | Zatwierdzona | Rezerwacja potwierdzona, obowiązuje |
| `rejected` | Odrzucona | Prośba odrzucona przez administratora |
| `counter_proposed` | Kontrpropozycja | Administrator zaproponował inny termin |

### Przepływ statusów

```
Złożenie prośby (Biuro / Zarząd)
        ↓
   [pending – oczekuje]
        ↓
  Administrator podejmuje decyzję:
  ├── Zatwierdza ──────────────────→ [approved – zatwierdzona]
  ├── Odrzuca ─────────────────────→ [rejected – odrzucona]
  └── Proponuje inny termin ───────→ [counter_proposed – kontrpropozycja]
                                              ↓
                                    Użytkownik decyduje:
                                    ├── Akceptuje ──→ [approved]
                                    └── Odrzuca ───→ [rejected]

Zatwierdzona rezerwacja:
        ↓
  Użytkownik wnioskuje o zmianę
        ↓
   [wniosek o zmianę – pending]
        ↓
  Administrator decyduje:
  ├── Zatwierdza zmianę ──→ rezerwacja zaktualizowana [approved]
  └── Odrzuca zmianę ────→ rezerwacja bez zmian [approved]
```

---

## Powiadomienia

Powiadomienia są dostępne pod ikoną dzwonka w pasku bocznym. Liczba przy ikonie oznacza nieprzeczytane powiadomienia.

### Rodzaje powiadomień

| Typ | Kto otrzymuje | Kiedy |
|-----|--------------|-------|
| Rezerwacja zatwierdzona | Wnioskodawca | Administrator zatwierdził prośbę |
| Rezerwacja odrzucona | Wnioskodawca | Administrator odrzucił prośbę |
| Kontrpropozycja | Wnioskodawca | Administrator zaproponował inny termin |
| Zmiana zatwierdzona | Wnioskodawca | Administrator zatwierdził wniosek o zmianę |
| Zmiana odrzucona | Wnioskodawca | Administrator odrzucił wniosek o zmianę |
| Nowa prośba | Wszyscy aktywni Administratorzy | Ktoś złożył prośbę o rezerwację |
| Wniosek o zmianę | Wszyscy aktywni Administratorzy | Ktoś wnioskuje o zmianę zatwierdzonej rezerwacji |
| Akcja Zarządu | Wszyscy aktywni Administratorzy | Zarząd zmodyfikował rezerwację sali zarządu |

## Ustawienia konta (`/ustawienia`)

Każdy użytkownik może:

- **Zmienić hasło** — wprowadź aktualne hasło, następnie nowe (min. 8 znaków) i potwierdź.
- **Ustawić preferowaną salę** — sala będzie domyślnie wybrana przy tworzeniu nowej rezerwacji.

---

## Bezpieczeństwo

- Hasła są szyfrowane algorytmem **PBKDF2-SHA256** (100 000 iteracji).
- Sesje mają ważność **24 godzin** i są przechowywane w bazie danych.
- Ciasteczka sesji są zabezpieczone flagami `HttpOnly`, `Secure` i `SameSite=Strict`.
- Wszyscy nowi użytkownicy muszą **zmienić hasło** przy pierwszym logowaniu.
- Wszystkie kluczowe akcje są zapisywane w **dzienniku audytu** (dostępnym tylko dla Super Admina).
- System wykrywa **konflikty terminów** i blokuje podwójne rezerwacje tej samej sali w tym samym czasie.
