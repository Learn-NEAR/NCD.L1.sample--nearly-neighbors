use near_sdk::json_types::U128;
use near_sdk::near_bindgen;

#[near_bindgen]
pub struct Proposal {}

#[near_bindgen]
impl Proposal {
    pub fn initialize() {}

    pub fn is_configured() {}

    pub fn configure(title: &str, description: &str, goal: U128, min_deposit: U128) {}

    pub fn toString() {}

    // pub fn add_supporter(coordinates: &str) {}
    pub fn add_supporter() {}

    // pub fn list_supporters(): PersistentVector<Supporter>

    pub fn get_factory() {}

    // pub fn get_proposal()
    pub fn get_funding_total() {}
    // pub fn is_fully_funded()
}
