// using OpenZeppelin tests - way faster than truffle
// use 'npm test' to run tests
// need
// npm install --save-dev @openzeppelin/test-environment mocha chai hardhat
// to work

const { accounts, contract } = require('@openzeppelin/test-environment');

const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const { ZERO_ADDRESS } = constants;

// Setup Chai for 'expect' or 'should' style assertions (you only need one)
const { expect } = require('chai');
//require('chai').should();

const TcrCoin = contract.fromArtifact('TcrToken');
const upgMock = contract.fromArtifact('upgradedToken');
const usdToken = contract.fromArtifact('TetherToken');

describe('TcrCoin', function () {
    const [owner, minter, pauser, blacklister, initialHolder, recipient, anotherAccount, bulk1, bulk2, bulk3] = accounts;

    const name = 'TecraCoin';
    const symbol = 'TCR';

    const tentho = new BN(10000);
    const sto = new BN(100);
    const ten = new BN(10);
    const one = new BN(1)

    before(async function () {
        this.token = await TcrCoin.new({ from: owner });
    });

    it('has a name', async function () {
        expect(await this.token.name()).to.equal(name);
    });

    it('has a symbol', async function () {
        expect(await this.token.symbol()).to.equal(symbol);
    });

    it('has 18 decimals', async function () {
        expect(await this.token.decimals()).to.be.bignumber.equal(new BN(8));
    });

    it('has 0 initial balance', async function () {
        expect(await this.token.totalSupply()).to.be.bignumber.equal(new BN(0));
    });

    it('publisher is owner', async function () {
        expect(await this.token.owner()).to.be.equal(owner)
    });

    describe('minter role', function () {
        it('owner add minter', async function () {
            await this.token.addMinter(minter, { from: owner });
        });
        it('minter can not mine more than 21mln', async function () {
            await expectRevert(this.token.mint(initialHolder, new BN("21000000000000000"), { from: minter }),
                'You can not mine that much')
        });
        it('minter mints to holder', async function () {
            expectEvent(await this.token.mint(initialHolder, sto, { from: minter }),
                'Transfer', {
                from: ZERO_ADDRESS,
                to: initialHolder,
                value: sto,
            });
        });
        it('not-minter can not mit', async function () {
            await expectRevert(this.token.mint(initialHolder, sto, { from: owner }),
                'Not a Minter')
        });
        it('holder transfer to recipient', async function () {
            expectEvent(await this.token.transfer(recipient, sto, { from: initialHolder }),
                'Transfer', {
                from: initialHolder,
                to: recipient,
                value: sto,
            });
        });
        it('recipien have proper balance after transfer', async function () {
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(sto);
        });
        it('owner removes minter from role', async function () {
            await this.token.removeMinter(minter, { from: owner })
        })
        it('minter no longer can mint', async function () {
            await expectRevert(this.token.mint(owner, sto, { from: minter }),
                'Not a Minter')
        })
    });

    describe('pauser role', function () {
        it('owner add pauser', async function () {
            await this.token.addPauser(pauser, { from: owner });
        });
        it('pauser pause', async function () {
            expectEvent(await this.token.pause({ from: pauser }),
                'Paused', {});
        });
        it('user can not transfer', async function () {
            await expectRevert(this.token.transfer(pauser, ten, { from: recipient }),
                'Contract is paused');
        });
        it('pause unpause', async function () {
            expectEvent(await this.token.unpause({ from: pauser }),
                'Unpaused', {});
        });
        it('user can transfer again', async function () {
            expectEvent(await this.token.transfer(pauser, ten, { from: recipient }),
                'Transfer', {
                from: recipient,
                to: pauser,
                value: ten,
            })
        });
        it('owner removes pauser from role', async function () {
            await this.token.removePauser(pauser, { from: owner })
        })
        it('pauser no longer can pauser', async function () {
            await expectRevert(this.token.pause({ from: pauser }),
                'Not a Pauser')
        })
    });

    describe('Blacklister role', function () {
        it('owner add blacklister', async function () {
            await this.token.addBlacklister(blacklister, { from: owner });
        })
        it('blaclister blackist pauser', async function () {
            expectEvent(await this.token.addBlacklist(pauser, { from: blacklister }),
                'AddedToBlacklist', { account: pauser })
        })
        it('blackisted can not transfer', async function () {
            await expectRevert(this.token.transfer(blacklister, ten, { from: pauser }),
                'Address on blacklist')
        })
        it('owner burns balck tokens', async function () {
            expectEvent(await this.token.burnBlackFunds(pauser, { from: owner }),
                'Transfer', {
                from: pauser,
                to: ZERO_ADDRESS,
                value: ten,
            })
        })
        it('blacklister removes from blacklist', async function () {
            expectEvent(await this.token.removeBlacklist(pauser, { from: blacklister }),
                'RemovedFromBlacklist', { account: pauser, })
        })
        it('owner removes blacklister from role', async function () {
            await this.token.removeBlacklister(blacklister, { from: owner })
        })
        it('blacklister no longer can blacklist', async function () {
            await expectRevert(this.token.addBlacklist(owner, { from: blacklister }),
                'Not a Blacklister')
        })
    });

    describe('Approve/allowance', function () {
        it('Set allowance', async function () {
            expectEvent(await this.token.approve(minter, sto, { from: recipient }),
                'Approval', {
                owner: recipient,
                spender: minter,
                value: sto,
            })
        })
        it('Use TrasnferFrom', async function () {
            let twoEvents = await this.token.transferFrom(recipient, anotherAccount, ten, { from: minter });
            expectEvent(twoEvents,
                'Approval', {
                owner: recipient,
                spender: minter,
                value: new BN(90),
            })
            expectEvent(twoEvents,
                'Transfer', {
                from: recipient,
                to: anotherAccount,
                value: ten,
            })
        })
    })

    describe('Bulk transfer', function () {

        let targetTable = [bulk1, bulk2, bulk3];
        let bulkAmounts = [one, new BN(2), new BN(3)];
        // recipient send 3 x 1 coin
        it('Bulk send same amount many times', async function () {
            let manyEvents = await this.token.methods['bulkTransfer(address[],uint256)'](targetTable, one, { from: recipient });
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk1,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk2,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk3,
                value: one,
            })
        })
        it('Bulk send differnt amounts many times', async function () {
            let manyEvents = await this.token.methods['bulkTransfer(address[],uint256[])'](targetTable, bulkAmounts, { from: recipient });
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk1,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk2,
                value: new BN(2),
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk3,
                value: new BN(3),
            })
        })
        it('Bulk TransferFrom - same amount', async function () {
            //approve minter
            expectEvent(await this.token.approve(minter, ten, { from: recipient }),
                'Approval', {
                owner: recipient,
                spender: minter,
                value: ten,
            })
            //bulkTransferFrom
            let manyEvents = await this.token.methods['bulkTransferFrom(address,address[],uint256)'](recipient, targetTable, one, { from: minter });
            //events: 1xApproval, 3xTransfer
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk1,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk2,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk3,
                value: one,
            })
            expectEvent(manyEvents,
                'Approval', {
                owner: recipient,
                spender: minter,
                value: new BN(7),
            })

        });
        it('Bulk TransferFrom - differnet amounts', async function () {
            //approve anotherAccount
            expectEvent(await this.token.approve(anotherAccount, ten, { from: recipient }),
                'Approval', {
                owner: recipient,
                spender: anotherAccount,
                value: ten,
            })
            //bulkTransferFrom
            let manyEvents = await this.token.methods['bulkTransferFrom(address,address[],uint256[])'](recipient, targetTable, bulkAmounts, { from: anotherAccount });
            //events: Approval, Transfer
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk1,
                value: one,
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk2,
                value: new BN(2),
            })
            expectEvent(manyEvents,
                'Transfer', {
                from: recipient,
                to: bulk3,
                value: new BN(3),
            })
            expectEvent(manyEvents,
                'Approval', {
                owner: recipient,
                spender: anotherAccount,
                value: new BN(9),
            })
            expectEvent(manyEvents,
                'Approval', {
                owner: recipient,
                spender: anotherAccount,
                value: new BN(7),
            })
            expectEvent(manyEvents,
                'Approval', {
                owner: recipient,
                spender: anotherAccount,
                value: new BN(4),
            })

        })
    })

    describe('acquire: Rouge token withdrawal', function () {
        let _initialSupply = tentho;
        let _name = 'USDToken';
        let _symbol = 'USDT';
        let _decimals = ten;

        it('Deploy rouge token contract', async function () {
            // send usdt to contract address
            this.usdt = await usdToken.new(_initialSupply, _name, _symbol, _decimals, { from: minter });
        })
        it('Trasnfer rouge tokens', async function () {
            expectEvent(await this.usdt.transfer(this.token.address, ten, { from: minter }),
                'Transfer', {
                from: minter,
                to: this.token.address,
                value: ten,
            })
        })
        it('Acquire tokens', async function () {
            // take usdt from contract to owner
            expectEvent(await this.token.acquire(this.usdt.address, { from: owner }),
                'Transfer', {
                from: this.token.address,
                to: owner,
                value: ten,
            })
        })
    })

    describe('change ownership', function () {
        it('owner delegates minter', async function () {
            await this.token.giveOwnership(minter, { from: owner })
        })
        it('minter accepts', async function () {
            await this.token.acceptOwnership({ from: minter })
        })
        it('minter is new owner', async function () {
            expect(await this.token.owner()).to.equals(minter)
        })
    })

    describe('Upgrade', function () {
        it('Publish update mock', async function () {
            this.upgToken = await upgMock.new(this.token.address, { from: owner });
            expect(await this.upgToken.oldToken()).to.be.equal(this.token.address)
        })
        it('Set upgrade from current owner', async function () {
            await this.token.upgrade(this.upgToken.address, { from: minter })
        })
        it('Is deprecated', async function () {
            expect(await this.token.deprecated()).to.be.true;
        })
        it('Call transfer on upgraded mock', async function () {
            //mock is not checking balance, always emit event and return true
            expectEvent(await this.token.transfer(owner, tentho, { from: minter }),
                'Transfer', {
                from: minter,
                to: owner,
                value: tentho,
            })
        })
        it('Call Approve on upgraded mock', async function () {
            //mock just emit event
            expectEvent(await this.token.approve(owner, tentho, { from: minter }),
                'Approval', {
                owner: minter,
                spender: owner,
                value: tentho,
            })
        })
        it('Call transferFrom on upgraded token mock', async function () {
            //mock is not checking anything just emits Approval and Transfer on send value
            let twoEvents = await this.token.transferFrom(minter, pauser, tentho, { from: owner });
            expectEvent(twoEvents,
                'Approval', {
                owner: minter,
                spender: owner,
                value: tentho,
            })
            expectEvent(twoEvents,
                'Transfer', {
                from: minter,
                to: pauser,
                value: tentho,
            })
        })
        it('Call balanceOf on upgraded mock', async function () {
            // mock returns 7777
            expect(await this.token.balanceOf(owner, { from: minter })).to.be.bignumber.equal(new BN(7777));
        })
        it('Call allowance on upgraded mock', async function () {
            // mock returns 8888
            expect(await this.token.allowance(owner, minter, { from: minter })).to.be.bignumber.equal(new BN(8888));
        })
        it('Call totalSupply on upgraded mock', async function () {
            // mock returns 9999
            expect(await this.token.totalSupply({ from: minter })).to.be.bignumber.equal(new BN(9999));
        })
    });

});
