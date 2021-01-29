// @nearfile out
import {
  u128,
  context,
  storage,
  PersistentVector,
  PersistentMap,
} from 'near-sdk-as';

import { MIN_ACCOUNT_BALANCE, AccountId } from '../../utils';

/**
 * >>>>> Project Contract <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
 *
 * The intent of a project is to realize a proposal.
 *
 * Once a proposal is fully funded, it is automatically converted to a project and all funds
 * transferred (except minimum storage staking for proposal contract persistence).
 *
 * Actually tracking project progress is outside the scope of this work and would fall to
 * an oracle or DAO.
 */

/**
 * == CONSTANTS ================================================================
 *
 * PROJECT_KEY = key used to identify project object in storage
 */
const PROJECT_KEY = 'state';

/**
 * == TYPES & STRUCTS ==========================================================
 *
 * Types & data models used by the contract.
 */

/**
 * @class Project
 * @property factory      - account ID of factory contract
 * @property proposal     - account ID of proposal that lead to funding this project
 * @property details      - general info about the project
 * @property funding      - funds and expense tracking
 * @property contributors - list of contributors to the project
 *
 * Top-level object for storing project data. Stored on-chain with `storage`.
 */
@nearBindgen
class Project {
  constructor(
    public factory: AccountId,
    public proposal: AccountId,
    public details: ProjectDetails | null = null,
    public funding: ProjectFunding | null = null,
    public contributors: PersistentMap<
      AccountId,
      Contribution
    > = new PersistentMap<AccountId, Contribution>('c')
  ) {}
}

/**
 * @class ProjectFunding
 * @property total     - total funding available to realize this project
 * @property spent     - total spent to date
 * @property expenses  - list of expenses
 *
 * Funds and expense tracking for a project.
 */
@nearBindgen
class ProjectFunding {
  constructor(
    public total: u128 = u128.Zero,
    public spent: u128 = u128.Zero,
    public expenses: PersistentVector<Expense> = new PersistentVector<Expense>(
      'e'
    )
  ) {}
}

/**
 * @class Expense
 * @property label  - descriptive name for expense
 * @property amount - default to zero for expense notes
 */
@nearBindgen
class Expense {
  constructor(
    public label: string,
    public amount: u128 = u128.Zero
  ) {}
}

/**
 * @class ProjectDetails
 * @property title        - project name
 * @property description  - more detailed explanation of the project
 * @property owner        - account ID of project owner
 */
@nearBindgen
class ProjectDetails {
  constructor(
    public title: string,
    public description: string,
    public owner: AccountId
  ) {}
}

/**
 * @class Contribution
 * @property account  - account ID of contributor
 * @property task     - task description and details assigned to this contributor
 * @property amount   - budget for this contribution
 * @property status   - status of the contribution
 */
@nearBindgen
export class Contribution {
  constructor(
    public account: AccountId,
    public task: string,
    public amount: u128 = u128.Zero,
    public status: TaskStatus = TaskStatus.ASSIGNED
  ) {}
}

enum TaskStatus {
  BLOCKED = 0 as i8,
  ASSIGNED = 1 as i8,
  IN_PROGRESS = 2 as i8,
  COMPLETED = 4 as i8,
}

/**
 * == PUBLIC METHODS ===========================================================
 *
 * The contract's public API.
 */

/**
 * @function initialize
 *
 * Sets up and stores new Project.
 */
export function initialize(proposal: AccountId): void {
  assert(!is_initialized(), 'Contract is already initialized.');
  assert(
    u128.ge(context.attachedDeposit, MIN_ACCOUNT_BALANCE),
    'MIN_ACCOUNT_BALANCE must be attached to initialize (3 NEAR)'
  );

  const project = new Project(context.predecessor, proposal);

  resave_project(project);
}

/**
 * @function configure
 * @param title        - project name
 * @param description  - more detailed explanation of the project
 *
 * Configures basic data for ProjectDetails and ProjectFunding.
 */
export function configure(title: string, description: string): void {
  assert_initialized();

  const project = get_project();
  project.details = new ProjectDetails(title, description, context.sender);
  project.funding = new ProjectFunding(
    u128.sub(context.accountBalance, MIN_ACCOUNT_BALANCE)
  );

  resave_project(project);
}

/**
 * @function add_funds
 *
 * Updates funding total with attached deposit.
 */
export function add_funds(): void {
  assert_configured();

  const funds = context.attachedDeposit;
  const project = storage.get<Project>(PROJECT_KEY)!;
  project.funding!.total = u128.add(project.funding!.total, funds);

  resave_project(project);
}

/**
 * @function add_contributor
 * @param account {AccountId}         - contributor account
 * @param contribution {Contribution} - contribution object
 *
 * Add a contributor to the project.
 *
 * TODO: why do we need to include the account param here, if it is already embedded within
 *  the contribution object?
 */
export function add_contributor(
  account: AccountId,
  contribution: Contribution
): void {
  assert_configured();

  const project = storage.get<Project>(PROJECT_KEY)!;
  const contributors = project.contributors;
  contributors.set(account, contribution);
  project.contributors = contributors;

  resave_project(project);
}

/**
 * @function add_expense
 * @param label {string} - expense label
 * @param amount  - expense amount
 *
 * Track an expense.
 *
 * TODO: find out if it is better to decompose types into the contract interface like this
 *  to save on serde costs... or better to keep the custom types exposed like in add_contributor()
 *  for better readability?
 */
export function add_expense(
  label: string,
  amount: u128 = u128.Zero
): void {
  assert_configured();

  const project = storage.get<Project>(PROJECT_KEY)!;
  const expense = new Expense(label, amount);
  project.funding!.expenses.push(expense);
  project.funding!.spent = u128.add(project.funding!.spent, amount);

  resave_project(project);
}

/**
 * @function get_project
 * @returns {Project}
 *
 * Gets the project from storage.
 */
export function get_project(): Project {
  assert_initialized();

  return storage.getSome<Project>(PROJECT_KEY);
}

/**
 * Block UX from project details page until fully configured
 */
export function is_configured(): bool {
  assert_initialized();

  return !!get_project().details;
}

/**
 * @function get_factory
 * @returns {AccountId}
 *
 * The account ID of the factory that created this project.
 */
export function get_factory(): AccountId {
  assert_initialized();

  return get_project().factory;
}

/**
 * @function get_proposal
 * @returns {AccountId}
 *
 * The account ID of the proposal for this project.
 */
export function get_proposal(): AccountId {
  assert_initialized();

  return get_project().proposal;
}

/**
 * @function get_remaining_budget
 * @returns {u128}
 *
 * The amount of funding still availale for the project (total - spent).
 */
export function get_remaining_budget(): u128 {
  assert_configured();

  const project = storage.get<Project>(PROJECT_KEY)!;
  return u128.sub(project.funding!.total, project.funding!.spent);
}

/**
 * @function get_expenses
 * @returns {[Expense]}
 *
 * All expenses logged for this project.
 */
export function get_expenses(): PersistentVector<Expense> {
  assert_configured();

  const project = storage.get<Project>(PROJECT_KEY)!;
  return project.funding!.expenses;
}

/**
 * @function get_contributors
 * @returns {{[AccountId]: Contribution}}
 *
 * Map of all contributors's accounts to their contribution.
 */
export function get_contributors(): PersistentMap<AccountId, Contribution> {
  assert_configured();

  const project = storage.get<Project>(PROJECT_KEY)!;
  return project.contributors;
}

/**
 * == PRIVATE FUNCTIONS ========================================================
 *
 * Not to be called outside of this proposal.
 */

/**
 * Whether or not the project has been initialized.
 */
function is_initialized(): bool {
  return !!storage.hasKey(PROJECT_KEY);
}

/**
 * Updates the proposal data in storage.
 */
function resave_project(project: Project): void {
  storage.set(PROJECT_KEY, project);
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
