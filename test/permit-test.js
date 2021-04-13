// from OpenZeppelin test

const { accounts, contract } = require('@openzeppelin/test-environment');
const { BN, constants, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { MAX_UINT256 } = constants;

const { fromRpcSig } = require('ethereumjs-util');
const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

const ERC20Permit = contract.fromArtifact('TcrToken');

const { EIP712Domain, domainSeparator } = require('./eip712');

const Permit = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
];

describe('ERC20-Permit', function () {
    const [initialHolder, spender] = accounts;

    const initialSupply = new BN(100);

    const name = 'TecraCoin';
    const version = '1';

    beforeEach(async function () {
        this.token = await ERC20Permit.new({ from: initialHolder });

        // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
        // from within the EVM as from the JSON RPC interface.
        // See https://github.com/trufflesuite/ganache-core/issues/515
        this.chainId = await this.token.getChainId();

        //we need some tokens :)
        await this.token.addMinter(initialHolder, { from: initialHolder });
        await this.token.mint(initialHolder, initialSupply, { from: initialHolder });
    });

    it('initial nonce is 0', async function () {
        expect(await this.token.nonces(initialHolder)).to.be.bignumber.equal('0');
    });

    it('domain separator match', async function () {
        expect(
            await this.token.DOMAIN_SEPARATOR(),
        ).to.equal(
            await domainSeparator(name, version, this.chainId, this.token.address),
        );
    });

    describe('permit', function () {
        const wallet = Wallet.generate();

        const owner = wallet.getAddressString();
        const value = new BN(42);
        const nonce = 0;
        const maxDeadline = MAX_UINT256;

        const buildData = (chainId, verifyingContract, deadline = maxDeadline) => ({
            primaryType: 'Permit',
            types: { EIP712Domain, Permit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, spender, value, nonce, deadline },
        });

        it('accepts owner signature', async function () {
            const data = buildData(this.chainId, this.token.address);
            const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
            const { v, r, s } = fromRpcSig(signature);

            const receipt = await this.token.permit(owner, spender, value, maxDeadline, v, r, s);

            expect(await this.token.nonces(owner)).to.be.bignumber.equal('1');
            expect(await this.token.allowance(owner, spender)).to.be.bignumber.equal(value);
        });

        it('rejects reused signature', async function () {
            const data = buildData(this.chainId, this.token.address);
            const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
            const { v, r, s } = fromRpcSig(signature);

            await this.token.permit(owner, spender, value, maxDeadline, v, r, s);

            await expectRevert(
                this.token.permit(owner, spender, value, maxDeadline, v, r, s),
                'permit: INVALID_SIGNATURE',
            );
        });

        it('rejects other signature', async function () {
            const otherWallet = Wallet.generate();
            const data = buildData(this.chainId, this.token.address);
            const signature = ethSigUtil.signTypedMessage(otherWallet.getPrivateKey(), { data });
            const { v, r, s } = fromRpcSig(signature);

            await expectRevert(
                this.token.permit(owner, spender, value, maxDeadline, v, r, s),
                'permit: INVALID_SIGNATURE',
            );
        });

        it('rejects expired permit', async function () {
            const deadline = (await time.latest()) - time.duration.weeks(1);

            const data = buildData(this.chainId, this.token.address, deadline);
            const signature = ethSigUtil.signTypedMessage(wallet.getPrivateKey(), { data });
            const { v, r, s } = fromRpcSig(signature);

            await expectRevert(
                this.token.permit(owner, spender, value, deadline, v, r, s),
                'permit: EXPIRED',
            );
        });
    });
});
