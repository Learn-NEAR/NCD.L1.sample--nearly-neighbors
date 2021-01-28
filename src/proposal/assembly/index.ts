// @nearfile out
import {
  u128,
  context,
  storage,
  PersistentVector,
  ContractPromise,
} from 'near-sdk-as';

import { XCC_GAS, MIN_ACCOUNT_BALANCE, AccountId, asNEAR } from '../../utils';

/**
 * >>>>> Proposal Contract <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 *
 * The proposal contract represents a user's proposed idea for a development project.
 *
 * Proposals have details and funding data (goal, current total, minimum deposit), and they accept
 * funding from supporters.
 *
 * If proposals are fully funded by their due date, then they are closed and converted to a
 * project contract (with all funds transferred to the new project's account).
 *
 * Otherwise, then they are closed and all funds are returned to the supporters.
 *
 * TODO: implement & update remaining methods
 * - [ ] implement cancelProposal() - if not funded by due date, then abort
 * - [ ] implement reimburseFunds() - return funds to supporters
 * - [ ] implement transferFunds() - move all funding to created project
 * - [ ] update create_project() to call transfer_funds()
 */

/**
 * == CONSTANTS ================================================================
 *
 * PROPOSAL_KEY = key used to identify proposal object in storage
 */
const PROPOSAL_KEY = 'nn';

/**
 * == TYPES & STRUCTS ==========================================================
 *
 * Types & data models used by the contract.
 */

/**
 * @class Proposal
 * @property factory  - account ID of factory contract
 * @property funding  - funding configuration & state
 * @property details  - general info about the proposal
 *
 * Top-level object for storing proposal information. Stored on-chain with `storage`.
 */
@nearBindgen
class Proposal {
  constructor(
    public factory: AccountId,
    public funding: ProposalFunding | null = null,
    public details: ProposalDetails | null = null
  ) {}
}

/**
 * @class ProposalFunding
 * @property goal         - target funding amount
 * @property min_deposit  - minimum required deposit for supporters to pledge
 * @property total        - current total funding accumulated
 * @property funded       - whether or not total is at or above the goal
 */
@nearBindgen
class ProposalFunding {
  constructor(
    public goal: u128,
    public min_deposit: u128 = MIN_ACCOUNT_BALANCE,
    public total: u128 = u128.Zero,
    public funded: bool = false
  ) {}
}

/**
 * @class ProposalDetails
 * @property title        - proposal name
 * @property description  - more detailed explanation of the proposal
 * @property author       - account ID of proposal creator
 */
@nearBindgen
class ProposalDetails {
  constructor(
    public title: string,
    public description: string,
    public author: AccountId
  ) {}
}

/**
 * @class Supporter
 * @property account - supporter's account ID
 * @property amount  - amount pledged to proposal by supporter
 *
 * Represents a single proposal supporter, along with the amount they've pledged.
 */
@nearBindgen
class Supporter {
  constructor(public account: AccountId, public amount: u128) {}
}

/**
 * == PUBLIC METHODS ===========================================================
 *
 * The contract's public API.
 */

/**
 * @function initialize
 *
 * Sets up and stores new Proposal.
 */
export function initialize(): void {
  assert(!is_initialized(), 'Contract is already initialized.');
  assert(
    u128.ge(context.attachedDeposit, MIN_ACCOUNT_BALANCE),
    'MIN_ACCOUNT_BALANCE must be attached to initialize (3 NEAR)'
  );

  const proposal = new Proposal(context.predecessor);

  resave_proposal(proposal);
}

/**
 * @function configure
 * @param title        - proposal name
 * @param description  - more detailed explanation of the proposal
 * @param goal         - target funding amount
 * @param min_deposit  - minimum required deposit for supporters to pledge
 *
 * Configures basic data for ProposalDetails and ProposalFunding.
 */
export function configure(
  title: string,
  description: string,
  goal: u128,
  min_deposit: u128
): void {
  assert_initialized();

  const proposal = get_proposal();
  proposal.details = new ProposalDetails(title, description, context.sender);
  proposal.funding = new ProposalFunding(goal, min_deposit);

  resave_proposal(proposal);
}

/**
 * @function add_supporter
 *
 * Makes the sender a supporter of the proposal, using the attached NEAR as their pledge.
 * Will fail unless the attached deposit for the transaction is more than the configured
 * minimum deposit.
 */
export function add_supporter(): void {
  assert_configured();
  assert(!is_fully_funded(), 'Proposal is already fully funded.');

  const amount = context.attachedDeposit;
  const account = context.sender;

  const proposal = get_proposal();
  assert(
    u128.ge(context.attachedDeposit, proposal.funding!.min_deposit),
    'Please attach minimum deposit of [' +
      asNEAR(proposal.funding!.min_deposit) +
      '] NEAR'
  );

  const supporters = new PersistentVector<Supporter>('s');
  const supporter = new Supporter(account, amount);
  supporters.push(supporter);
  add_funding(amount);
}

/**
 * @function get_proposal
 * @returns {Proposal}
 *
 * Gets the proposal from storage.
 */
export function get_proposal(): Proposal {
  assert_initialized();

  return storage.getSome<Proposal>(PROPOSAL_KEY);
}

/**
 * @function get_factory
 * @returns {AccountId}
 *
 * The account ID of the factory that created this proposal.
 */
export function get_factory(): AccountId {
  assert_initialized();

  return get_proposal().factory;
}

/**
 * @function get_funding_total
 * @returns {u128}
 *
 * The current total funding accumulated.
 */
export function get_funding_total(): u128 {
  assert_configured();

  const proposal = storage.get<Proposal>(PROPOSAL_KEY)!;
  return proposal.funding!.total;
}

/**
 * @function list_supporters
 * @returns {[Supporter]}
 *
 * All current supporters of the proposal.
 */
export function list_supporters(): PersistentVector<Supporter> {
  assert_configured();

  const supporters = new PersistentVector<Supporter>('s');
  return supporters;
}

/**
 * @function is_configured
 * @returns {bool}
 *
 * True if configure() has already been successfully called, otherwise false.
 * Allows UX to block proposal details page until fully configured.
 */
export function is_configured(): bool {
  assert_initialized();

  return !!get_proposal().details;
}

/**
 * @function is_fully_funded
 * @returns {bool}
 *
 * Whether or not total is at or above the goal.
 */
export function is_fully_funded(): bool {
  assert_configured();

  const funding = get_funding_total();
  const goal = get_proposal().funding!.goal;
  return u128.ge(funding, goal);
}

/**
 * @function to_string
 * @returns {string}
 *
 * A friendly URI-like string identifying the proposal. Eventually this may look like:
 *
 *   '<project title>.<proposal|project>.neighborly.<testnet|mainnet>'
 *
 * Examples:
 *
 *   'lulus-cafe.proposal.neighborly.testnet'
 *   'common-grounds.project.neighborly.testnet'
 */
export function toString(): string {
  assert_configured();

  const proposal = get_proposal();
  return 'title: [' + proposal.details!.title + ']';
}

/**
 * == PRIVATE FUNCTIONS ========================================================
 *
 * Not to be called outside of this proposal.
 */

/**
 * Updates the funding total by amount given.
 *
 * If this puts the total over goal, then this will call out to create_project().
 */
function add_funding(amount: u128): void {
  const current_total = get_funding_total();
  const new_amount = u128.add(amount, current_total);

  const proposal = get_proposal();
  const funding = proposal.funding!;

  funding.total = new_amount;
  funding.funded = u128.ge(funding.total, funding.goal);

  resave_proposal(proposal);

  if (funding.funded) {
    create_project();
  }
}

/**
 * Calls out to the factory contract to create a project from this proposal.
 *
 * Having the factory handle this work makes it easier to version.
 */
function create_project(): void {
  const proposal = get_proposal();
  // const projectBudget = u128.sub(context.accountBalance, MIN_ACCOUNT_BALANCE);

  ContractPromise.create(
    proposal.factory, // target contract account name
    'create_project', // target method name
    proposal.details, // target method arguments
    XCC_GAS // gas attached to the call
    // projectBudget             // deposit attached to the call
  );
}

/**
 * Updates the proposal data in storage.
 */
export function resave_proposal(proposal: Proposal): void {
  storage.set(PROPOSAL_KEY, proposal);
}

/**
 * Whether or not the project has been initialized.
 */
function is_initialized(): bool {
  return storage.hasKey(PROPOSAL_KEY);
}

/**
 * Guard against contract not having been initialized.
 */
function assert_initialized(): void {
  assert(is_initialized(), 'Contract must be initialized first.');
}

/**
 * Guard against contract not having been configured.
 */
function assert_configured(): void {
  assert(is_configured(), 'Contract must be configured first.');
}
