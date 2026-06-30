# Dostęp i uprawnienia — Rezerwacja Sal

> Wygenerowano: 2026-06-29  
> Projekt: Lafrentz / salki  
> Stack: React Router v7, Cloudflare Workers, D1 (SQLite)

---

## 1. Role użytkowników

System obsługuje cztery aktywne role. Rola `dyrektor` istnieje w schemacie bazy danych (dla kompatybilności wstecznej), ale nie jest już używana przez aplikację — istniejący użytkownicy z tą rolą zostali przeniesieni do `pracownik`.

| Identyfikator   | Etykieta       | Opis                                                  |
|-----------------|----------------|-------------------------------------------------------|
| `super_admin`   | Super Admin    | Pełna kontrola nad systemem                           |
| `admin`         | Administrator  | Zarządzanie rezerwacjami i użytkownikami              |
| `zarzad`        | Zarząd         | Dostęp do sal zarządowych, wnioskuje o rezerwacje     |
| `pracownik`     | Biuro          | Podstawowy dostęp, wnioskuje o sale ogólne            |

---

## 2. Matryca uprawnień

### 2.1 Uwierzytelnianie i sesja

| Operacja                    | pracownik | zarzad | admin | super_admin |
|-----------------------------|:---------:|:------:|:-----:|:-----------:|
| Logowanie                   | ✓         | ✓      | ✓     | ✓           |
| Wylogowanie                 | ✓         | ✓      | ✓     | ✓           |
| Zmiana własnego hasła       | ✓         | ✓      | ✓     | ✓           |
| Wymuszona zmiana hasła      | ✓         | ✓      | ✓     | ✓           |
| Ulubiona sala               | ✓         | ✓      | ✓     | ✓           |
| Dyżur (on-duty)             | ✗         | ✗      | ✓     | ✓           |

> Sesja wygasa po **24 godzinach**. Token przechowywany jest w httpOnly cookie.

---

### 2.2 Widoczność sal w kalendarzu

| Kategoria sali | pracownik | zarzad | admin | super_admin |
|----------------|:---------:|:------:|:-----:|:-----------:|
| Sale ogólne    | ✓         | ✓      | ✓     | ✓           |
| Sale zarządowe | ✗         | ✓      | ✓     | ✓           |

---

### 2.3 Składanie rezerwacji

| Akcja                                              | pracownik | zarzad | admin | super_admin |
|----------------------------------------------------|:---------:|:------:|:-----:|:-----------:|
| Wniosek o salę ogólną (wymaga zatwierdzenia)       | ✓         | ✓      | —     | —           |
| Bezpośrednia rezerwacja sali ogólnej (bez zatw.)   | ✗         | ✗      | ✓     | ✓           |
| Wniosek o salę zarządową (wymaga zatwierdzenia)    | ✗         | ✓      | —     | —           |
| Bezpośrednia rezerwacja sali zarządowej (bez zatw.)| ✗         | ✓      | ✓     | ✓           |

> Admini i super_admini tworzą rezerwacje ze statusem `approved` od razu; nie przechodzą przez kolejkę wniosków.

---

### 2.4 Zarządzanie własnymi rezerwacjami

| Akcja                                      | pracownik | zarzad | admin | super_admin |
|--------------------------------------------|:---------:|:------:|:-----:|:-----------:|
| Podgląd własnych rezerwacji                | ✓         | ✓      | ✓     | ✓           |
| Edycja własnego wniosku (status: pending)  | ✓         | ✓      | ✓     | ✓           |
| Usunięcie własnej rezerwacji               | ✓         | ✓      | ✓     | ✓           |
| Akceptacja kontrpropozycji                 | ✓         | ✓      | ✓     | ✓           |
| Odrzucenie kontrpropozycji                 | ✓         | ✓      | ✓     | ✓           |
| Wniosek o zmianę zatwierdzonej rezerwacji  | ✓         | ✓      | ✓     | ✓           |

---

### 2.5 Administracja rezerwacjami (panel admina)

| Akcja                                          | pracownik | zarzad | admin | super_admin |
|------------------------------------------------|:---------:|:------:|:-----:|:-----------:|
| Podgląd cudzych rezerwacji                     | ✗         | ✗      | ✓     | ✓           |
| Lista wniosków oczekujących                    | ✗         | ✗      | ✓     | ✓           |
| Zatwierdzenie wniosku                          | ✗         | ✗      | ✓     | ✓           |
| Odrzucenie wniosku                             | ✗         | ✗      | ✓     | ✓           |
| Kontrpropozycja terminu                        | ✗         | ✗      | ✓     | ✓           |
| Edycja dowolnej rezerwacji                     | ✗         | ✗      | ✓     | ✓           |
| Usunięcie dowolnej rezerwacji                  | ✗         | ✗      | ✓     | ✓           |
| Zatwierdzenie wniosku o zmianę                 | ✗         | ✗      | ✓     | ✓           |
| Odrzucenie wniosku o zmianę                    | ✗         | ✗      | ✓     | ✓           |
| Wszystkie rezerwacje z filtrowaniem i paginacją| ✗         | ✗      | ✓     | ✓           |

---

### 2.6 Zarządzanie użytkownikami

| Akcja                                          | pracownik | zarzad | admin | super_admin |
|------------------------------------------------|:---------:|:------:|:-----:|:-----------:|
| Podgląd listy użytkowników                     | ✗         | ✗      | ✓     | ✓           |
| Tworzenie konta (pracownik)                    | ✗         | ✗      | ✓     | ✓           |
| Tworzenie konta (admin)                        | ✗         | ✗      | ✓     | ✓           |
| Tworzenie konta (zarzad)                       | ✗         | ✗      | ✗     | ✓           |
| Przypisywanie roli pracownik / admin           | ✗         | ✗      | ✓     | ✓           |
| Przypisywanie roli zarzad                      | ✗         | ✗      | ✗     | ✓           |
| Edycja imienia i e-maila użytkownika           | ✗         | ✗      | ✓     | ✓           |
| Aktywacja / dezaktywacja konta                 | ✗         | ✗      | ✓     | ✓           |
| Reset hasła użytkownika                        | ✗         | ✗      | ✓     | ✓           |
| Usunięcie użytkownika                          | ✗         | ✗      | ✓     | ✓           |
| Edycja własnego konta przez admina             | ✗ (brak)  | —      | ✗     | ✗           |

> System blokuje dezaktywację, reset hasła i usunięcie własnego konta.

---

### 2.7 Zarządzanie salami

| Akcja                        | pracownik | zarzad | admin | super_admin |
|------------------------------|:---------:|:------:|:-----:|:-----------:|
| Dodawanie nowej sali         | ✗         | ✗      | ✗     | ✓           |
| Edycja danych sali           | ✗         | ✗      | ✗     | ✓           |
| Aktywacja / dezaktywacja sali| ✗         | ✗      | ✗     | ✓           |

---

### 2.8 Logi audytu

| Akcja                        | pracownik | zarzad | admin | super_admin |
|------------------------------|:---------:|:------:|:-----:|:-----------:|
| Podgląd logów audytu         | ✗         | ✗      | ✗     | ✓           |

---

### 2.9 Powiadomienia

| Akcja                                            | pracownik | zarzad | admin | super_admin |
|--------------------------------------------------|:---------:|:------:|:-----:|:-----------:|
| Otrzymywanie powiadomień systemowych             | ✓         | ✓      | ✓     | ✓           |
| Powiadomienia e-mail (wnioski) — tylko na dyżurze| ✗         | ✗      | ✓     | ✓           |

---

## 3. Co widać w kalendarzu

- **pracownik**: tylko sale ogólne, własne wnioski (pending/counter_proposed) + zatwierdzone rezerwacje wszystkich w tych salach
- **zarzad**: sale ogólne i zarządowe, własne wnioski + zatwierdzone rezerwacje wszystkich
- **admin / super_admin**: wszystkie sale, wszystkie rezerwacje ze statusem `pending`, `approved`, `counter_proposed`

---

## 4. Przepływ statusów rezerwacji

```
         [złożono wniosek]
               │
         status: pending
          ┌────┴────┐
     odrzucono  zatwierdzono
          │          │
      rejected    approved ◄──────────────┐
                     │                    │
            (wniosek o zmianę)     accept_counter
                     │                    │
          change_request: pending    counter_proposed
               ┌────┴────┐              │
          approved   rejected    reject_counter
                                        │
                                    rejected
```

---

## 5. Znalezione błędy i problemy

### 🔴 Krytyczne

#### BUG-1: Zagnieżdżony `<Form>` w sidebarze — dyżur prawdopodobnie nie działa

**Plik:** [app/routes/_app.tsx](app/routes/_app.tsx#L174-L177)

```tsx
{user.role === "admin" && (
  <Form method="post" action="/logout" className="w-full mb-2">
    <OnDutyToggle onDuty={!!user.on_duty} />
  </Form>
)}
```

`OnDutyToggle` renderuje własny `<Form method="post" action="/ustawienia">` wewnątrz powyższego `<Form>`. Zagnieżdżone formularze HTML są nieprawidłowe — przeglądarka ignoruje wewnętrzny `<form>`, a kliknięcie przycisku dyżuru wysyła pusty POST do `/logout`, wylogowując użytkownika.

**Naprawa:** Usunąć zewnętrzny `<Form>` — `OnDutyToggle` już ma własny.

---

#### BUG-2: `super_admin` nie widzi przycisku dyżuru w sidebarze

**Plik:** [app/routes/_app.tsx](app/routes/_app.tsx#L174)

```tsx
{user.role === "admin" && (   // brakuje super_admin
```

Super admin może włączyć dyżur przez stronę Ustawienia, ale nie przez sidebar. Niespójność z logiką w `ustawienia.tsx` gdzie dyżur jest dostępny dla obu ról.

**Naprawa:** Zmienić warunek na `isAdmin(user.role)` lub `user.role === "admin" || user.role === "super_admin"`.

---

#### BUG-3: Eskalacja uprawnień — `admin` może modyfikować konto `super_admin`

**Plik:** [app/routes/admin.uzytkownicy.tsx](app/routes/admin.uzytkownicy.tsx#L63-L131)

Akcje `edit_profile`, `toggle_active`, `reset_password` i `delete_user` nie sprawdzają roli **docelowego** użytkownika. Admin (który nie może przypisać roli `super_admin`) może:
- Edytować imię i e-mail super_admina
- Dezaktywować jego konto
- Zresetować mu hasło
- Usunąć jego konto

**Naprawa:** W każdej z tych akcji pobrać target user i odrzucić z 403 jeśli `target.role === 'super_admin' && actor.role !== 'super_admin'`.

---

### 🟡 Poważne

#### BUG-4: Brak sprawdzenia konfliktu przy zatwierdzaniu wniosku o zmianę

**Plik:** [app/routes/rezerwacje.$id.zmiana.tsx](app/routes/rezerwacje.$id.zmiana.tsx#L56-L81)

Przy zatwierdzeniu `change_request` (approve_cr) kod aktualizuje datę/godziny rezerwacji bez sprawdzenia, czy nowy termin nie koliduje z inną zatwierdzoną rezerwacją w tej sali. Może to prowadzić do podwójnej rezerwacji.

**Naprawa:** Przed `UPDATE bookings` dodać overlap check analogiczny do tego w `rezerwacje.$id.tsx:73-81`.

---

#### BUG-5: SQL string interpolation w zapytaniu dashboardu

**Plik:** [app/routes/dashboard.tsx](app/routes/dashboard.tsx#L40-L41)

```ts
const statusFilter = isAdmin(user.role)
  ? `status IN ('pending','approved','counter_proposed')`
  : `(status = 'approved' OR (requester_id = ${user.id} AND status IN ('pending','counter_proposed')))`;
```

`user.id` jest wstawiony bezpośrednio do stringa SQL (bez parametryzacji). `user.id` pochodzi z sesji bazy danych (liczba całkowita), więc ryzyko SQL injection jest aktualnie niskie, ale to zły wzorzec podatny na błędy przy refaktoryzacji.

**Naprawa:** Przebudować zapytanie tak, żeby `user.id` był przekazywany jako parametr (`?`).

---

### 🔵 Drobne / UX

#### BUG-6: Niezgodność komentarza z logiką dostępu do szczegółów rezerwacji

**Plik:** [app/routes/rezerwacje.$id.tsx](app/routes/rezerwacje.$id.tsx#L26-L30)

Komentarz mówi: *"only owner, admins, or same-room board members can view"*, ale kod sprawdza tylko właściciela lub admina. Użytkownicy `zarzad` nie mogą zobaczyć cudzych rezerwacji nawet dla sal zarządowych.

**Naprawa:** Zaktualizować komentarz (lub zaimplementować brakującą logikę dla `zarzad`).

---

#### BUG-7: Lokalne liczniki powiadomień zerowane zbyt agresywnie

**Plik:** [app/routes/_app.tsx](app/routes/_app.tsx#L106-L114)

Nawigacja do **jakiejkolwiek** strony rezerwacji zeruje lokalny licznik odznak powiadomień w UI — nawet jeśli użytkownik ma nieodczytane powiadomienia dotyczące innych rezerwacji. Backend prawidłowo oznacza jako przeczytane tylko powiadomienia związane z daną rezerwacją.

**Naprawa:** Po powrocie z podstrony rezerwacji pobrać aktualny licznik z `/api/notifications` zamiast go zerować.

---

#### BUG-8: Pole `attendee_emails` istnieje w modelu ale nie ma UI

**Pliki:** [app/types.ts](app/types.ts#L47), [app/routes/rezerwacje.nowa.tsx](app/routes/rezerwacje.nowa.tsx), [app/routes/rezerwacje.$id.zmiana.tsx](app/routes/rezerwacje.$id.zmiana.tsx)

Pole `attendee_emails` jest zdefiniowane w typie `Booking` i modelu bazy danych, ale żaden formularz nie pozwala go wypełnić. Funkcjonalność jest częściowo zaimplementowana (baza danych obsługuje, kod change request obsługuje pole `new_attendee_emails`) ale nie dostępna dla użytkownika.

---

## 6. Pozytywne aspekty bezpieczeństwa

- Hasła przechowywane jako PBKDF2 SHA-256, 100 000 iteracji, z solą
- Sesje HTTP-only, Secure, SameSite=Strict
- Sesje przechowywane w bazie (możliwe unieważnienie)
- Wymuszona zmiana hasła przy pierwszym logowaniu
- Optimistic locking na rezerwacjach (pole `version`) — zapobiega race conditions
- Sprawdzanie konfliktu terminów przed zatwierdzeniem i przed kontrpropozycją
- Pełny log audytu wszystkich kluczowych akcji
- Autoryzacja weryfikowana zarówno w loaderze jak i akcji (nie tylko na UI)
- `super_admin` nie może być przypisany przez zwykłego admina

---

*Dokument wygenerowany na podstawie analizy kodu źródłowego.*
