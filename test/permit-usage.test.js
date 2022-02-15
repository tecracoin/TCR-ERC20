// use permit approval by contract

const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN, constants, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { MAX_UINT256 } = constants;

const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

const ERC20Permit = contract.fromArtifact('TcrToken');
const UsePermit = contract.fromArtifact('usePermit');

const { EIP712Domain } = require('./eip712');

const Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
];

describe('Permit usage test', function () {
    const [initialHolder, recipient] = accounts;

    const initialSupply = new BN(100);

    const name = 'TecraCoin';
    const version = '1';

    const wallet = Wallet.generate();
    const owner = wallet.getChecksumAddressString();
    const value = new BN(42);
    const nonce = 0;
    const maxDeadline = MAX_UINT256;

    before(async function () {
        this.token = await ERC20Permit.new({ from: initialHolder });

        // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
        // from within the EVM as from the JSON RPC interface.
        // See https://github.com/trufflesuite/ganache-core/issues/515
        this.chainId = await this.token.getChainId();

        //we need some tokens :)
        await this.token.addMinter(initialHolder, { from: initialHolder });
        await this.token.mint(initialHolder, initialSupply, { from: initialHolder });
    });

    describe('Usage of permit by contract', function () {

        it('Recipiet receive tokens', async function () {
            //owner need tokens
            expectEvent(await this.token.transfer(owner, initialSupply, { from: initialHolder }),
                'Transfer', {
                from: initialHolder,
                to: owner,
                value: initialSupply,
            });

            this.permitContract = await UsePermit.new({ from: initialHolder });
            const spender = this.permitContract.address;

            const buildData = (chainId, verifyingContract, deadline = maxDeadline) => ({
                primaryType: 'Permit',
                types: { EIP712Domain, Permit },
                domain: { name, version, chainId, verifyingContract },
                message: { owner, spender, value, nonce, deadline },
            });

            // prepare permit data
            const data = buildData(this.chainId, this.token.address);
            const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
            const { v, r, s } = fromRpcSig(signature);

            //recipient has nothing
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(new BN(0));

            //send permit from account outside transaction
            await this.permitContract.transferByPermit(
                this.token.address, owner, spender, recipient,
                value, maxDeadline, v, r, s, { from: initialHolder });

            //balance should match
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal(value);
        });
    });
});
