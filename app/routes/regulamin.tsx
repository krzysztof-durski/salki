export default function Regulamin() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Regulamin</h1>
        <p className="text-sm text-gray-500 mt-1">
          System rezerwacji sal — aplikacja wewnętrzna Lafrentz
        </p>
      </div>

      {/* ── Regulamin ─────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Regulamin korzystania z systemu
        </h2>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">1. Postanowienia ogólne</h3>
          <p className="text-sm text-gray-600">
            System służy do rezerwacji sal konferencyjnych i sal zarządu w
            firmie Lafrentz. Dostęp mają wyłącznie osoby zatrudnione lub
            współpracujące z firmą, którym administrator założył konto.
            Korzystanie z systemu oznacza akceptację niniejszego regulaminu.
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">2. Konto użytkownika</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>
              Login (adres e-mail) i hasło są przypisane indywidualnie i nie
              mogą być udostępniane innym osobom.
            </li>
            <li>
              Przy pierwszym logowaniu wymagana jest zmiana hasła nadanego przez
              administratora.
            </li>
            <li>
              Za wszystkie działania wykonane na koncie odpowiada osoba, do
              której konto jest przypisane.
            </li>
            <li>
              W razie podejrzenia nieuprawnionego dostępu do konta należy
              niezwłocznie zgłosić to administratorowi i zmienić hasło.
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">
            3. Zasady rezerwacji sal
          </h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>
              Rezerwacja sal ogólnych i sal zarządu odbywa się poprzez złożenie
              prośby lub bezpośrednie zarezerwowanie terminu, zależnie od roli
              użytkownika.
            </li>
            <li>
              Prośby o rezerwację wymagają zatwierdzenia przez administratora;
              do czasu zatwierdzenia termin ma status „oczekuje”.
            </li>
            <li>
              Rezerwacji dokonuje się z rzeczywistym zamiarem wykorzystania sali
              — jeśli spotkanie nie odbędzie się, rezerwację należy jak
              najszybciej anulować, aby zwolnić termin dla innych.
            </li>
            <li>
              System blokuje zakładanie dwóch rezerwacji tej samej sali w tym
              samym czasie.
            </li>
            <li>
              Zmiana zatwierdzonej rezerwacji (data, godzina, sala) wymaga
              złożenia wniosku o zmianę i jego zatwierdzenia przez
              administratora.
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">4. Zakazane działania</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>
              Dokonywanie rezerwacji „na wszelki wypadek” bez realnej potrzeby,
              blokujące dostępność sal innym pracownikom.
            </li>
            <li>Udostępnianie danych logowania osobom trzecim.</li>
            <li>
              Podejmowanie prób obejścia zabezpieczeń systemu lub uzyskania
              dostępu do funkcji poza przyznaną rolą.
            </li>
          </ul>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">5. Kontakt</h3>
          <p className="text-sm text-gray-600">
            Pytania dotyczące działania systemu, problemy techniczne lub
            zgłoszenia naruszeń regulaminu należy kierować do administratora
            systemu.
          </p>
        </div>
      </section>

      {/* ── RODO ──────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">
          Informacja o przetwarzaniu danych osobowych (RODO)
        </h2>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">Administrator danych</h3>
          <p className="text-sm text-gray-600">
            Lafrentz Polska Spółka z
            ograniczoną odpowiedzialnością z siedzibą w Poznaniu, ul.
            Grunwaldzka 182, PIXEL 1, piętro 6, 60-166, Poznań, wpisana do
            rejestru przedsiębiorców Krajowego Rejestru Sądowego prowadzonego
            przez Sąd Rejonowy Poznań Nowe Miasto i Wilda w Poznaniu, VIII
            Wydział Gospodarczy Krajowego Rejestru Sądowego pod numerem KRS
            000035454, NIP 7831004441.
            <br />
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">
            Jakie dane przetwarzamy i w jakim celu
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Kategoria danych
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Cel przetwarzania
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Podstawa prawna
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="px-3 py-2">
                    Imię i nazwisko, służbowy adres e-mail, rola w systemie
                  </td>
                  <td className="px-3 py-2">
                    Założenie konta, uwierzytelnianie i zarządzanie dostępem
                  </td>
                  <td className="px-3 py-2">
                    Art. 6 ust. 1 lit. b RODO — wykonanie umowy
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    Historia rezerwacji sal (tytuł, data, godziny, liczba
                    uczestników, notatki)
                  </td>
                  <td className="px-3 py-2">
                    Zarządzanie zasobami firmy i organizacja pracy
                  </td>
                  <td className="px-3 py-2">
                    Art. 6 ust. 1 lit. f RODO — uzasadniony interes
                    administratora
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    Adresy e-mail uczestników spotkań
                  </td>
                  <td className="px-3 py-2">
                    Organizacja spotkań i komunikacja
                  </td>
                  <td className="px-3 py-2">
                    Art. 6 ust. 1 lit. f RODO — uzasadniony interes
                    administratora
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">
                    Logi audytowe (kto, jaką akcję, kiedy)
                  </td>
                  <td className="px-3 py-2">
                    Bezpieczeństwo systemu, rozliczalność, wykrywanie nadużyć
                  </td>
                  <td className="px-3 py-2">
                    Art. 6 ust. 1 lit. f RODO — uzasadniony interes
                    administratora
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Adresy IP, tokeny sesji</td>
                  <td className="px-3 py-2">
                    Utrzymanie bezpiecznej sesji użytkownika
                  </td>
                  <td className="px-3 py-2">
                    Art. 6 ust. 1 lit. b RODO — wykonanie umowy
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="font-medium text-gray-900">
            Jak długo przechowujemy dane
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Kategoria danych
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    Okres przechowywania
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                <tr>
                  <td className="px-3 py-2">Dane konta użytkownika</td>
                  <td className="px-3 py-2">
                    Przez czas zatrudnienia; konto jest usuwane ręcznie przez
                    administratora po jego zakończeniu
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Rezerwacje i zmiany rezerwacji</td>
                  <td className="px-3 py-2">
                    6 miesięcy od daty rezerwacji, następnie usuwane
                    automatycznie
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Logi audytowe</td>
                  <td className="px-3 py-2">
                    12 miesięcy od daty zdarzenia, następnie usuwane
                    automatycznie
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Tokeny sesji</td>
                  <td className="px-3 py-2">
                    Do momentu wylogowania lub wygaśnięcia sesji
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">Odbiorcy danych</h3>
          <p className="text-sm text-gray-600">
            Dane przechowywane są w bazie danych <strong>Cloudflare D1</strong>{" "}
            (Cloudflare, Inc., USA) na serwerach zlokalizowanych w Europejskim
            Obszarze Gospodarczym (EOG). Przekazanie danych do Cloudflare odbywa
            się na podstawie standardowych klauzul umownych (SCC) zatwierdzonych
            przez Komisję Europejską zgodnie z art. 46 ust. 2 lit. c RODO.
            Polityka prywatności Cloudflare:{" "}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              cloudflare.com/privacypolicy
            </a>
            . Dane nie są przekazywane innym podmiotom zewnętrznym ani
            wykorzystywane w celach marketingowych.
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">Twoje prawa</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>
              <strong>Prawo dostępu</strong> — możesz zażądać informacji o tym,
              jakie Twoje dane przetwarzamy.
            </li>
            <li>
              <strong>Prawo do sprostowania</strong> — możesz zażądać
              poprawienia nieprawidłowych lub uzupełnienia niekompletnych
              danych.
            </li>
            <li>
              <strong>Prawo do usunięcia</strong> — możesz zażądać usunięcia
              danych w przypadkach określonych w art. 17 RODO (o ile nie
              koliduje to z obowiązkami wynikającymi z przepisów prawa lub
              umowy).
            </li>
            <li>
              <strong>Prawo do ograniczenia przetwarzania</strong> — możesz
              zażądać czasowego wstrzymania przetwarzania Twoich danych.
            </li>
            <li>
              <strong>Prawo do sprzeciwu</strong> — możesz wnieść sprzeciw wobec
              przetwarzania opartego na uzasadnionym interesie (art. 6 ust. 1
              lit. f RODO).
            </li>
            <li>
              <strong>Prawo do skargi</strong> — masz prawo wnieść skargę do
              Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2, 00-193
              Warszawa,{" "}
              <a
                href="https://uodo.gov.pl"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                uodo.gov.pl
              </a>
              .
            </li>
          </ul>
          <p className="text-sm text-gray-600 pt-1">
            Wnioski dotyczące realizacji praw kieruj na adres:{" "}
            <strong> office@lafrentz.pl </strong>.
          </p>
        </div>

        <div className="space-y-1">
          <h3 className="font-medium text-gray-900">
            Zautomatyzowane podejmowanie decyzji
          </h3>
          <p className="text-sm text-gray-600">
            System nie stosuje zautomatyzowanego podejmowania decyzji ani
            profilowania w rozumieniu art. 22 RODO.
          </p>
        </div>
      </section>

      <p className="text-xs text-gray-400">
        Dokument zaktualizowany: 2026-07-01
      </p>
    </div>
  );
}
