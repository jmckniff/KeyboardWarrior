function Gear () {
    
    var gear = this;
    gear.head = new Armor("head", 12640, "Lionheart Helm", "", "https://wow.zamimg.com/images/wow/icons/large/inv_helmet_36.jpg", 2, 2, 18, 0, 0, 0, 0, 0, 0, 0, 0, 565, 0, null);
    gear.neck = null;
    gear.shoulder = null;
    gear.back = null;
    gear.chest = null;
    gear.wrist = null;
    gear.hands = null;
    gear.waist = null;
    gear.legs = null;
    gear.feet = null;
    gear.finger1 = null;
    gear.finger2 = null;
    gear.trinket1 = null;
    gear.trinket2 = null;
    gear.mainhand = null;
    gear.offhand = null;
    gear.ranged = null;
    
    gear.calculateStats = function () {
        return {
            strength: 0,
            stamina: 0,
            agility: 0,
            intellect: 0,
            meleeAttackPower: 0,
            rangedAttackPower: 0,
            criticalStrike: 0,
            hit: 0,
            dodge: 0,
            block: 0,
            parry: 0
        };
    }
}

function Armor(
    type,
    itemId,
    name,
    description,
    iconUrl,
    crit,
    hit,
    strength,
    stamina,
    agility,
    meleeAttackPower,
    rangedAttackPower,
    dodge,
    parry,
    block, 
    defense, 
    armor, 
    skill, 
    skillType) {
        this.type = type;
        this.itemId = itemId;
        this.name = name;
        this.description = description;
        this.iconUrl = iconUrl;
        this.crit = crit;
        this.hit = hit;
        this.strength = strength;
        this.stamina;
        this.agility;
        this.meleeAttackPower;
        this.rangedAttackPower;
        this.dodge;
        this.parry;
        this.block; 
        this.defense; 
        this.armor; 
        this.skill; 
        this.skillType;

}