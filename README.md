# DAO голосование
Смарт контракт, который вызывает сигнатуру функции посредством голосования пользователей.

##### Принцип работы следующий:
- Для участия в голосовании пользователям необходимо внести  токены для голосования. 
- Вывести токены с DAO, пользователи могут только после окончания всех голосований, в которых они участвовали. 
- Голосование может предложить только председатель.
- Для участия в голосовании пользователю необходимо внести депозит, один токен один голос. 
- Пользователь может участвовать в голосовании одними и теми же токенами, то есть пользователь внес 100 токенов он может участвовать в голосовании №1 всеми 100 токенами и в голосовании №2 тоже всеми 100 токенами.
- Финишировать голосование может любой пользователь по прошествии определенного количества времени установленном в конструкторе.

##### Тестовые контракты и транзакции
- Контракт токена https://rinkeby.etherscan.io/address/0xa49ff59952215fc8371b874e901eded363f25a80
- Контракт счетчика CALL https://rinkeby.etherscan.io/address/0xe4b87cc4972ae7c4cc4f37c6497709f47c665e0e
- Контракт DAO https://rinkeby.etherscan.io/address/0x7b42599b68c147f134a4c122109031443927fd46#code


##### npx hardhat test:
```shell
  DAO
    ✔ Checking that contract token is deployed
    ✔ Checking that contract counterCall is deployed
    ✔ Checking that contract DAO is deployed
    ✔ Checking that DAO has role a DAO_ROLE (163ms)
    ✔ Checking that proposal has role a PROPOSAL_ROLE (182ms)
    ✔ Checking function deposit() (210ms)
    ✔ Checking function withdraw() (315ms)
    ✔ Checking function withdraw() during and after proposal (293ms)
    ✔ Checking function addProposal() (323ms)
    ✔ Checking function vote() (333ms)
    ✔ Checking function finishProposal(id) vote > 50% (540ms)
    ✔ Checking function finishProposal(id) vote < 50% (453ms)
    ✔ Checking function finishProposal(id) vote < minimumQuorum (365ms)
```
##### npx hardhat coverage:
```shell
------------------|----------|----------|----------|----------|----------------|
File              |  % Stmts | % Branch |  % Funcs |  % Lines |Uncovered Lines |
------------------|----------|----------|----------|----------|----------------|
 contracts\       |      100 |      100 |      100 |      100 |                |
  DAO.sol         |      100 |      100 |      100 |      100 |                |
------------------|----------|----------|----------|----------|----------------|
All files         |      100 |      100 |      100 |      100 |                |
------------------|----------|----------|----------|----------|----------------|
```