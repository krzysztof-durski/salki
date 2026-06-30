# Dokumentacja systemu — Lafrentz Rezerwacja Sal

Witaj w dokumentacji systemu rezerwacji sal konferencyjnych **Lafrentz Salki**.

---

## Spis treści

| Dokument | Opis |
|----------|------|
| [Ogólny opis systemu](ogolne.md) | Jak działa system, przepływ rezerwacji, statusy, powiadomienia |
| [Super Admin](super-admin.md) | Pełne uprawnienia: użytkownicy, sale, logi, rezerwacje |
| [Administrator](administrator.md) | Zarządzanie rezerwacjami, użytkownikami, kolejka próśb |
| [Zarząd](zarzad.md) | Rezerwacje sal zarządu i ogólnych, edycja bez zatwierdzeń |
| [Biuro (Pracownik)](biuro.md) | Składanie próśb o rezerwację sal ogólnych |

---

## Role w systemie

System wyróżnia cztery aktywne role użytkowników:

| Rola | Polska nazwa | Zakres dostępu |
|------|-------------|----------------|
| `super_admin` | Super Admin | Pełny dostęp do wszystkiego |
| `admin` | Administrator | Zarządzanie rezerwacjami i użytkownikami |
| `zarzad` | Zarząd | Sale zarządu + ogólne, edycja bezpośrednia |
| `pracownik` | Biuro | Tylko sale ogólne, prośby wymagają zatwierdzenia |

---

## Szybki przegląd uprawnień

### Co widzi każda rola w kalendarzu?

| Typ sali | Biuro | Zarząd | Administrator | Super Admin |
|----------|:-----:|:------:|:-------------:|:-----------:|
| Sale ogólne | ✓ | ✓ | ✓ | ✓ |
| Sale zarządu | ✗ | ✓ | ✓ | ✓ |

### Kto może co robić?

| Akcja | Biuro | Zarząd | Administrator | Super Admin |
|-------|:-----:|:------:|:-------------:|:-----------:|
| Prośba o salę ogólną | ✓ | ✓ | — | — |
| Bezpośrednia rezerwacja sali | ✗ | ✗ | ✓ | ✓ |
| Prośba o salę zarządu | ✗ | ✓ | — | — |
| Bezpośrednia rezerwacja sali zarządu | ✗ | ✓* | ✓ | ✓ |
| Zatwierdzanie próśb | ✗ | ✗ | ✓ | ✓ |
| Zarządzanie użytkownikami | ✗ | ✗ | ✓ | ✓ |
| Tworzenie kont Zarządu | ✗ | ✗ | ✗** | ✓ |
| Zarządzanie salami | ✗ | ✗ | ✗** | ✓ |
| Logi audytu | ✗ | ✗ | ✗ | ✓ |

\* Zarząd może edytować swoje rezerwacje sal zarządu bezpośrednio bez zatwierdzenia.  
\*\* Może być odblokowane przez Super Admina dla konkretnego Administratora.

---

## Statusy rezerwacji

```
[złożona prośba] → pending (oczekuje)
    ↓
Administrator zatwierdza / odrzuca / proponuje kontrpropozycję
    ↓
approved (zatwierdzona) | rejected (odrzucona) | counter_proposed (kontrpropozycja)
    ↓ (przy kontrpropozycji)
Użytkownik akceptuje → approved | Użytkownik odrzuca → rejected
    ↓ (przy zatwierdzonej)
Wniosek o zmianę → change_request: pending → Administrator zatwierdza/odrzuca
```

---

## Kontakt i wsparcie

W razie problemów technicznych skontaktuj się z Super Adminem systemu.
