import { VMContext, u128 } from 'near-sdk-as';
import * as contract from '../assembly';
import { toYocto } from '../../utils';

/**
 * == CONFIG VALUES ============================================================
 */
const TITLE = 'common grounds';
const DESCRIPTION = 'your neighborhood coffee spot';
const GOAL = toYocto(50);
const MIN_DEPOSIT = toYocto(3);
const FACTORY_ACCOUNT_ID = 'neighbors.factory';

/**
 * == HELPER FUNCTIONS =========================================================
 */
const useFactoryAsPredecessor = (): void => {
  VMContext.setPredecessor_account_id(FACTORY_ACCOUNT_ID);
};

const setCurrentAccount = (): void => {
  VMContext.setCurrent_account_id('alice');
};

const attachDeposit = (deposit: number): void => {
  VMContext.setAttached_deposit(toYocto(deposit));
};

const attachMinDeposit = (): void => {
  VMContext.setAttached_deposit(MIN_DEPOSIT);
};

const doInitialize = (): void => {
  contract.initialize();
};

const doConfigure = (): void => {
  contract.configure(TITLE, DESCRIPTION, GOAL, MIN_DEPOSIT);
};

const initAndConfig = (): void => {
  attachMinDeposit();
  doInitialize();
  doConfigure();
};

describe('20.nearly-neighbors.proposal', () => {
  beforeEach(setCurrentAccount);
  beforeEach(useFactoryAsPredecessor);

  describe('initialize(): void', () => {
    it('creates a new proposal, storing the factory account ID (predecessor)', () => {
      attachMinDeposit();
      contract.initialize();
      expect(contract.get_factory()).toBe(FACTORY_ACCOUNT_ID);
    });

    it('requires a minimum deposit be attached', () => {
      expect(() => {
        contract.initialize();
      }).toThrow();
    });
  });

  describe('configure(title, description, goal, min_deposit): void', () => {
    beforeEach(attachMinDeposit);

    it('adds details and funding data to proposal', () => {
      doInitialize();

      expect(() => {
        contract.get_funding_total();
      }).toThrow();

      doConfigure();

      const proposal = contract.get_proposal();
      expect(proposal.details).not.toBeNull();
      expect(proposal.details!.title).toBe(TITLE);
      expect(proposal.details!.description).toBe(DESCRIPTION);
      expect(proposal.details!.author).toBe('bob');

      expect(proposal.funding!.goal).toBe(GOAL);
      expect(proposal.funding!.min_deposit).toBe(MIN_DEPOSIT);
    });

    it('switches is_configured() to true', () => {
      doInitialize();

      expect(contract.is_configured()).toBe(false);
      doConfigure();
      expect(contract.is_configured()).toBe(true);
    });
  });

  describe('add_supporter(): void', () => {
    beforeEach(initAndConfig);

    it('adds the signer + deposit to the list of supporters', () => {
      expect(contract.list_supporters().length).toBe(0);

      attachDeposit(4);
      VMContext.setSigner_account_id('cc');
      contract.add_supporter();

      const supporters = contract.list_supporters();
      expect(supporters.length).toBe(1);
      expect(supporters[0].account).toBe('cc');
      expect(supporters[0].amount).toBe(toYocto(4));
    });

    it('updates the funding total', () => {
      expect(contract.list_supporters().length).toBe(0);
      expect(contract.get_funding_total()).toBe(u128.from(0));

      attachDeposit(5);
      VMContext.setSigner_account_id('carol');
      contract.add_supporter();

      expect(contract.list_supporters().length).toBe(1);
      expect(contract.get_funding_total()).toBe(toYocto(5));
    });
  });

  describe('get_proposal(): Proposal', () => {
    beforeEach(initAndConfig);

    it('returns the proposal object with factory, details, and funding', () => {
      const proposal = contract.get_proposal();

      expect(proposal.factory).not.toBeNull();
      expect(proposal.details).not.toBeNull();
      expect(proposal.funding).not.toBeNull();
    });
  });

  describe('get_factory(): Proposal', () => {
    beforeEach(useFactoryAsPredecessor);
    beforeEach(initAndConfig);

    it('returns factory account id', () => {
      expect(contract.get_factory()).toBe(FACTORY_ACCOUNT_ID);
    });
  });

  describe('get_funding_total(): u128', () => {
    beforeEach(initAndConfig);

    it('returns the current funding amount (accounting for MIN_ACCOUNT_BALANCE)', () => {
      expect(contract.get_funding_total()).toBe(u128.from(0));
    });
  });

  describe('list_supporters(): [Supporter]', () => {
    beforeEach(initAndConfig);

    it('returns an array of supporters', () => {
      expect(contract.list_supporters().length).toBe(0);

      attachDeposit(4);
      VMContext.setSigner_account_id('carol');
      contract.add_supporter();

      const supporters = contract.list_supporters();
      expect(supporters.length).toBe(1);
      expect(supporters[0].account).toBe('carol');
      expect(supporters[0].amount).toBe(toYocto(4));
    });
  });

  describe('is_fully_funded(): bool', () => {
    beforeEach(initAndConfig);

    it('returns true when funding total is greater than or equal to the goal', () => {
      expect(contract.is_fully_funded()).toBe(false);

      attachDeposit(50);
      VMContext.setSigner_account_id('carol');
      contract.add_supporter();

      expect(contract.is_fully_funded()).toBe(true);
    });
  });

  describe('resave_proposal(Proposal): void', () => {
    beforeEach(initAndConfig);

    it('updates the stored proposal data', () => {
      const proposal = contract.get_proposal();

      expect(proposal.details!.title).toBe(TITLE);
      const newTotal = toYocto(4);
      proposal.details!.title = 'new title';
      proposal.funding!.total = newTotal;

      expect(contract.get_proposal().details!.title).not.toBe('new title');
      expect(contract.get_proposal().funding!.total).not.toBe(newTotal);
      contract.resave_proposal(proposal);
      expect(contract.get_proposal().funding!.total).toBe(newTotal);
      expect(contract.get_proposal().details!.title).toBe('new title');
      expect(contract.get_funding_total()).toBe(newTotal);
    });
  });

  describe('when not initialized', () => {
    beforeEach(attachMinDeposit);

    it('initialize() is idempotent; will throw if already initialized', () => {
      contract.initialize();

      expect(() => {
        contract.initialize();
      }).toThrow();
    });

    it('configure() throws', () => {
      expect(doConfigure).toThrow();
    });
  });

  describe('when not configured', () => {
    beforeEach(attachMinDeposit);
    beforeEach(doInitialize);

    it('get_funding_total() throws', () => {
      expect(() => {
        contract.get_funding_total();
      }).toThrow();
    });

    it('is_fully_funded() throws', () => {
      expect(() => {
        contract.is_fully_funded();
      }).toThrow();
    });

    it('toString() throws', () => {
      expect(() => {
        contract.toString();
      }).toThrow();
    });

    it('add_supporter() throws', () => {
      expect(() => {
        contract.add_supporter();
      }).toThrow();
    });

    it('list_supporters() throws', () => {
      expect(() => {
        contract.list_supporters();
      }).toThrow();
    });
  });
});
