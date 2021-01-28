import { context, PersistentSet } from "near-sdk-as"

type AccountId = string

@nearBindgen
class Proposal {
  constructor(
    public title: string,
    public description: string,
    public author: AccountId
  ) {}
}

const proposals = new PersistentSet<AccountId>("p")

export function create_project(proposal: Proposal): void {
  // confirm that project is in the original list of projects created by this factory
  assert(proposals.has(context.predecessor), "Unkown proposal account")
  
  // create a project for this proposal using xcc and reasonable naming convention
  const funding = context.attachedDeposit
  
  // xcc here  
}

export function create_proposal(): void {
  // create a proposal using xcc and reasonable naming convention
  const proposal = "some_new_account"
  
  // add to proposal set
  proposals.add(proposal)
}