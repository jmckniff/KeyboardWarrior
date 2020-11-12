$(document).ready(function() {
    var game = Game;
    game.start("Chobo");

    $(document).trigger(Events.weaponSpeedChanged, 3.4);
});

var Events = {
    targetChanged: "game.targetChanged",
    targetDamageTaken: "game.target.damageTaken",
    targetHealthChanged: "game.target.healthChanged",

    weaponSpeedChanged: "game.weaponSpeed.changed",

    playerTriggeredSpellCast: "game.player.triggeredSpellCast",
    playerCastSpell: "game.player.castSpell",
    playerSpellReady: "game.spell.ready",
    playerEnergyGained: "game.player.energy.gained",
    playerEnergyReduced: "game.player.energy.reduced",

    mobDied: "game.mob.died",

    showNotification: "game.ui.showNotification"
};

var Spells = {
    Bloodthirst: new Bloodthirst(),
    BattleShout: new BattleShout(),
    Bloodrage: new Bloodrage()
};

function Mob(name, health, level, armor) {
    var mob = this;
    mob.name = name;
    mob.health = health;
    mob.level = level;
    mob.armor = armor;

    mob.container = $("#boss");
    mob.container.click(function() {
        $(document).trigger(Events.targetChanged, mob);
    });

    mob.combatText = CombatText;
    mob.combatText.setup();
    mob.healthBar = new HealthBar($("#target"), mob.health);

    mob.update = function(delta) {
        mob.healthBar.update(delta);
        mob.combatText.update(delta);
    };

    mob.render = function() {
        mob.healthBar.render();
        mob.combatText.render();
    };

    mob.takeDamage = function(attack) {
        mob.health -= attack.damage;

        if (mob.health <= 0) {
            mob.health = 0;
            $(document).trigger(Events.mobDied, mob.name);
        }

        $(document).trigger(Events.targetDamageTaken, attack);
        $(document).trigger(Events.targetHealthChanged, mob.health);
    };
}

var SwingTimer = {
    container: null,
    value: null,
    label: null,
    width: 0,
    weaponSpeed: 0,
    weaponSpeedInMilliseconds: 0,
    isAttacking: false,
    time: 0,
    timeInSeconds: 0,
    setup: function() {
        var self = this;
        self.container = $("#swing-timer");
        self.value = $("#swing-timer .value");
        self.label = $("#swing-timer .label");
        self.width = self.container.width();

        self.container.hide();

        $(window).on("resize", function() {
            self.width = self.container.width();
        });

        $(document).on(Events.weaponSpeedChanged, function(e, weaponSpeed) {
            if (!weaponSpeed) {
                return;
            }

            self.time = 0;
            self.weaponSpeed = weaponSpeed;
            self.weaponSpeedInMilliseconds = weaponSpeed * 1000;
            self.tickInterval =
                self.weaponSpeedInMilliseconds / self.totalTicks;
        });

        $(document).on(Events.targetChanged, function(e, target) {
            self.isAttacking = target != "none";
            self.time = 0;
        });
    },
    update: function(delta) {
        var self = this;

        if (!self.isAttacking) {
            self.container.hide();
            return;
        }

        self.container.show();

        if (self.time > self.weaponSpeedInMilliseconds) {
            self.time = 0;
        }

        self.time += delta;
        self.timeInSeconds = (self.time / 1000).toFixed(2);
    },
    render: function() {
        var self = this;

        if (!self.isAttacking) {
            return;
        }

        var timeRemaining = 100 * self.time / self.weaponSpeedInMilliseconds;
        var width = timeRemaining / 100 * self.width;

        self.label.text(self.timeInSeconds);
        self.value.width(width);
    }
};

var CombatText = {
    container: null,
    attack: null,
    setup: function() {
        var self = this;
        self.container = $(".combat-text");

        $(document).on(Events.targetDamageTaken, function(e, attack) {
            self.attack = attack;
        });
    },
    update: function(delta) {},
    render: function() {
        var self = this;

        if (!self.attack) {
            return;
        }

        var damage = $("<div/>", {
            text: self.attack.damage
        });

        if (self.attack.type == "melee") {
            damage.addClass("white-hit");
        }

        if (self.attack.type == "spell") {
            damage.addClass("yellow-hit");
        }

        if (self.attack.isCrit) {
            damage.addClass("crit");
        }

        self.container.append(damage);

        setTimeout(function() {
            damage.fadeOut(function() {
                //damage.remove();
            });
        }, 500);

        self.attack = null;
    }
};

function HealthBar(container, max) {
    var self = this;
    self.max = max;
    self.currentValue = max;
    self.currentPercent = 100;
    self.container = container;
    self.label = container.find(".health-bar .label");
    self.value = container.find(".health-bar .value");
    self.width = 0;

    $(document).on(Events.targetChanged, function(e, target) {
        self.container.show();
        self.width = self.value.width();
    });

    $(document).on(Events.targetHealthChanged, function(e, health) {
        self.currentValue = health;
    });

    self.update = function(delta) {
        self.currentPercent = Utils.getPercentageFromValue(
            self.currentValue,
            self.max
        );
    };

    self.render = function() {
        self.label.text(self.currentValue);
        self.value.width(self.currentPercent + "%");
    };
}



var Player = {
    name: "Chobo",
    gear: {
        mainhand: null
    },

    isAttacking: false,
    isInCombat: false,
    target: null,
    energy: null,
    energyBar: null,
    swingTimer: null,
    spellQueue: null,
    setup: function() {
        var player = this;

        player.energy = new Rage();

        player.swingTimer = SwingTimer;
        player.swingTimer.setup();

        player.energyBar = EnergyBar;
        player.energyBar.setup("rage", 100);

        player.gear.mainhand = {
            speed: 3.4,
            minDamage: 174,
            maxDamage: 264,
            dps: 72,
            strength: 42
        };
        
        player.spellQueue = new SpellQueue(player.handleSpellCastComplete.bind(this));

        $(document).on(Events.targetChanged, function(e, target) {
            player.target = target;
            player.isAttacking = target != null;
        });

        $(document).on(Events.playerTriggeredSpellCast, function(e, spell) {
            player.castSpell(spell);
        });
    },

    castSpell: function(spell) {
        var self = this;
        if (!self.target) {
            $(document).trigger(
                Events.showNotification,
                new ErrorNotification("No target selected")
            );
            return;
        }

        if (self.energy.current < spell.energyCost) {
            $(document).trigger(
                Events.showNotification,
                new ErrorNotification(`Not enough ${self.energy.type}`)
            );
            return;
        }
        
        if (self.spellQueue.isQueued(spell.name)) {
             $(document).trigger(
                Events.showNotification,
                new ErrorNotification("Spell not ready yet")
            );
            return;
        }
        
        self.spellQueue.queue(spell);
        
        if (spell.energyCost > 0) {
            self.energy.spend(spell.energyCost);
        }
    },
    
    handleSpellCastComplete: function(spell) {
        
        if (spell.type == "attack") {
            var attack = spell.cast(this, this.target);
            this.target.takeDamage(attack);
        }
        
        if (spell.type == "aura") {
            spell.cast(player);
        }
        
        // TODO Convert this to aura where we pass the player to the spell.cast method and have it apply to the energy gain instead.
        if (spell.generatesEnergy) {
            var energyGenerated = spell.generateEnergy(this);
            this.energy.add(energyGenerated);
        }
        
        $(document).trigger(Events.playerCastSpell, spell);
    },

    update: function(delta) {
        var player = this;
        
        player.energyBar.update(delta);
        player.spellQueue.update(delta);

        var weaponSpeed =  player.gear.mainhand.speed * 1000;
        var autoAttack = new MeleeAutoAttack(weaponSpeed);
        
        if (player.isAttacking && !player.spellQueue.isQueued(autoAttack)) {
            player.spellQueue.queue(autoAttack);
        }
        
        player.swingTimer.update(delta);
    },
    render: function() {
        var player = this;
        player.energyBar.render();
        player.swingTimer.render();
    }
};

function Attack(attacker, target, type, name, isCrit, damage) {
    this.attacker = attacker;
    this.target = target;
    this.type = type;
    this.name = name;
    this.isCrit = isCrit;
    this.damage = damage;
    this.datetime = new Date();
}

var Game = {
    player: null,
    boss: null,
    swingTimer: null,
    loop: null,
    fpsCounter: null,
    limit: 300,
    lastFrameTimeMs: 0,
    maxFPS: 60,
    delta: 0,
    timestep: 1000 / 60,
    fps: 60,
    framesThisSecond: 0,
    lastFpsUpdate: 0,
    actionBar: null,
    start: function(player) {
        var game = this;
        //
        game.fpsCounter = $("#fps-counter");
        game.player = Player;
        game.player.setup();
        game.boss = new Mob("Golemagg", 360000, 63, 3700);
        game.combatLog = new CombatLog();
        game.actionBar = new ActionBar();
        game.buffBar = new BuffBar();
        game.notifier = new Notifier();

        requestAnimationFrame(game.loop.bind(this));
    },
    update: function(delta) {
        var game = this;
        game.player.update(game.timestep);
        game.boss.update(game.timestep);
        game.combatLog.update(game.timestep);
        game.actionBar.update(game.timestep);
        game.buffBar.update(game.timestep);
        game.notifier.update(game.timestep);
    },
    render: function() {
        var game = this;
        game.fpsCounter.text(Math.round(game.fps) + " FPS");
        game.player.render();
        game.boss.render();
        game.combatLog.render();
        game.actionBar.render();
        game.buffBar.render();
        game.notifier.render();
    },
    loop: function(timestamp) {
        var game = this;

        if (timestamp < game.lastFrameTimeMs + 1000 / game.maxFPS) {
            requestAnimationFrame(game.loop.bind(this));
            return;
        }

        game.delta += timestamp - game.lastFrameTimeMs;
        game.lastFrameTimeMs = timestamp;

        if (timestamp > game.lastFpsUpdate + 1000) {
            game.fps = 0.25 * game.framesThisSecond + 0.75 * game.fps;

            game.lastFpsUpdate = timestamp;
            game.framesThisSecond = 0;
        }

        game.framesThisSecond++;

        var numUpdateSteps = 0;
        while (game.delta >= game.timestep) {
            game.update(game.timestep);
            game.delta -= game.timestep;
            if (++game.numUpdateSteps >= 240) {
                game.panic();
                break;
            }
        }

        game.render();

        requestAnimationFrame(game.loop.bind(this));
    }
};

function calculateRage(damage, attackSpeed, isMainhand, isCrit) {
    // assuming level is 60.
    var conversionValue = 230.6;
    var hitFactor = isCrit && isMainhand ? 7 : 3.5;
    var minRage = 15 * damage / conversionValue;
    var rage =
        15 * damage / (4 * conversionValue) + hitFactor * attackSpeed / 2;

    return Math.round(Math.min(rage, minRage));
}

var EnergyBar = {
    container: null,
    value: null,
    label: null,
    width: 0,
    max: 0,
    currentValue: 0,
    currentPercent: 0,
    type: null,
    setup: function(type, max) {
        var self = this;
        self.container = $(".energy-bar");
        self.value = self.container.find(".value");
        self.label = self.container.find(".label");
        self.width = self.container.width();
        self.max = max;
        self.energyType = type;

        $(document).on(Events.playerEnergyGained, function(e, amount) {
            self.currentValue = amount;
        });

        $(document).on(Events.playerEnergyReduced, function(
            e,
            currentEnergy,
            energyReduction
        ) {
            self.currentValue = currentEnergy;
        });
    },
    update: function(delta) {
        var self = this;
        self.currentPercent = Utils.getPercentageFromValue(
            self.currentValue,
            self.max
        );
    },
    render: function() {
        var self = this;
        self.label.text(self.currentValue + "/" + self.max);
        self.value.width(self.currentPercent + "%");
    }
};

function clamp(num, min, max) {
    return num <= min ? min : num >= max ? max : num;
}

function Rage() {
    this.max = 100;
    this.min = 0;
    this.current = 0;
    this.type = "rage";
    
    this.add = function(amount) {
        var energy = this;
        energy.current += amount;

        if (energy.current > energy.max) {
            energy.current = energy.max;
        }
        
        $(document).trigger(
            Events.playerEnergyGained,
            energy.current
        );
    };

    this.spend = function(amount) {
        this.current -= amount;
        if (this.current < 0) {
            this.current = 0;
        }

        $(document).trigger(
            Events.playerEnergyReduced,
            this.current,
            this.amount
        );
    };
}

function CombatLog() {
    var self = this;
    self.container = $("#combat-log .messages");
    self.history = [];
    self.queue = [];
    self.messages = [];

    $(document).on(Events.targetDamageTaken, function(e, attack) {
        self.queue.push(attack);
    });

    self.update = function(delta) {
        for (var i = 0; i < self.queue.length; i++) {
            var attack = self.queue[i];
            var d = attack.datetime;
            var time = `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;

            var text = `${attack.attacker}'s ${attack.name} ${
                attack.isCrit ? "crits" : "hits"
            } ${attack.target} for ${attack.damage} damage`;
            self.messages.push({ time: time, text: text });

            self.queue.splice(i, 1);
            i--;
        }
    };

    self.render = function() {
        for (var i = 0; i < self.messages.length; i++) {
            var message = self.messages[i];

            var messageElement = $("<div/>", { class: "message" });
            var timeElement = $("<span/>", {
                class: "time",
                text: `${message.time.toString("HH:mm:ss:fff")}`
            });
            var textElement = $("<span/>", { text: message.text });
            messageElement.append(timeElement, textElement);

            self.container.prepend(messageElement);

            self.messages.splice(i, 1);
            i--;
        }
    };
}

var Utils = {
    getValueFromPercentage: function(current, total) {
        return current / 100 * total;
    },
    getPercentageFromValue: function(current, total) {
        return 100 * current / total;
    }
};

function SpellIcon(container, spell) {
    var self = this;
    self.container = container;
    self.spell = spell;
    self.cooldownRemaining = 0;
    self.hasSpellReadyEventSent = true;
    self.cooldownOverlay = null;
    self.cooldownTimeRemaining = null;
    self.tooltip = new SpellTooltip(container, spell);
    self.container.css("background-image", `url(${self.spell.imageUrl})`);

    self.container.click(function() {
        self.triggerSpellCast();
    });

    $(document).on(Events.playerCastSpell, function(e, castSpell) {
        if (castSpell.name == self.spell.name) {
            if (self.cooldownRemaining > 0) {
                return;
            }
            self.cooldownRemaining = spell.cooldown;
            self.hasSpellReadyEventSent = false;
        }
    });

    self.triggerSpellCast = function() {
        $(document).trigger(Events.playerTriggeredSpellCast, self.spell);
    };

    self.update = function(delta) {
        if (self.cooldownRemaining <= 0) {
            self.cooldownRemaining = 0;
        }

        if (self.cooldownRemaining > 0) {
            self.cooldownRemaining -= delta;
        }
    };

    self.render = function() {
        if (!self.hasSpellReadyEventSent & (self.cooldownRemaining == 0)) {
            $(document).trigger(Events.playerSpellReady, self.spell);
            self.hasSpellReadyEventSent = true;
        }

        if (!self.cooldownOverlay && self.cooldownRemaining > 0) {
            self.cooldownOverlay = $("<div/>", { class: "on-cooldown" });
            self.cooldownTimeRemaining = $("<div/>", {
                class: "cooldown-remaining"
            });
            self.container.append(
                self.cooldownOverlay,
                self.cooldownTimeRemaining
            );
        }

        if (self.cooldownRemaining > 0) {
            var cooldownRemainingInSeconds = self.cooldownRemaining / 1000;
            var cooldownRounded = Math.ceil(cooldownRemainingInSeconds);
            if (cooldownRounded > 0) {
                self.cooldownTimeRemaining.text(cooldownRounded);
            }
            self.cooldownOverlay.show();
            self.cooldownTimeRemaining.show();
        }

        if (self.cooldownOverlay && self.cooldownRemaining <= 0) {
            self.cooldownOverlay.fadeOut();
            self.cooldownTimeRemaining.fadeOut();
        }
    };
}

function ActionBar() {
    var self = this;

    self.actions = [
        {
            hotkeys: ["1"],
            spellIcon: new SpellIcon($("#bloodthirst"), Spells.Bloodthirst)
        },
        {
            hotkeys: ["2"],
            spellIcon: new SpellIcon($("#battle-shout"), Spells.BattleShout)
        }
    ];

    for (var i = 0; i < self.actions.length; i++) {
        var hks = self.actions[i].hotkeys;
        var spellIcon = self.actions[i].spellIcon;

        hotkeys(hks[0], function(e, handler) {
            e.preventDefault();
            var spellIcon = self.findSpellIconByHotkey(handler.key);
            if (!spellIcon) {
                return;
            }
            spellIcon.triggerSpellCast();
        });
    }

    self.findSpellIconByHotkey = function(hotkey) {
        for (var i = 0; i < self.actions.length; i++) {
            var action = self.actions[i];
            var hks = action.hotkeys;
            for (var j = 0; j < hks.length; j++) {
                if (hks[j] == hotkey) {
                    return action.spellIcon;
                }
            }
        }

        return null;
    };

    self.update = function(delta) {
        for (var i = 0; i < self.actions.length; i++) {
            var spellIcon = self.actions[i].spellIcon;
            spellIcon.update(delta);
        }
    };

    self.render = function() {
        for (var i = 0; i < self.actions.length; i++) {
            var spellIcon = self.actions[i].spellIcon;
            spellIcon.render();
        }
    };
}

function Action(spellIcon, hotkey) {
    var self = this;
    self.spellIcon = spellIcon;
    self.hotkey = hotkey;
}

function Notifier() {
    var self = this;
    self.container = $("#notifications");
    self.notifications = [];

    $(document).on(Events.showNotification, function(e, notification) {
        self.notifications.push(notification);
    });

    self.update = function(delta) {};

    self.render = function() {
        for (var i = 0; i < self.notifications.length; i++) {
            var notification = self.notifications[i];
            var notificationElement = $("<span/>", {
                text: notification.message
            });

            if (notification.type == "error") {
                notificationElement.addClass("error");
            }

            self.container.prepend(notificationElement);
            self.notifications.splice(i, 1);

            setTimeout(function() {
                notificationElement.fadeOut(function() {
                    notificationElement.remove();
                });
            }, notification.duration);
        }
    };
}

function Notification(message, type, duration) {
    this.message = message;
    this.type = type;
    this.duration = duration;
}

function ErrorNotification(message) {
    this.message = message;
    this.type = "error";
    this.duration = 2000;
}

function MeleeAutoAttack(weaponSpeed, isMainhandAttack) {
    var self = this;
    
    this.name = "melee attack";
    this.type = "attack";
    this.energyCost = 0;
    this.energyType = null;
    this.generatesEnergy = true;
    this.castTime = 0;
    this.castTimeRemaining = 0;
    this.causesGCD = false;
    this.cooldown = weaponSpeed;
    this.cooldownRemaining = 0;
    this.isCriticalStrike = false;
    this.isMainhandAttack = isMainhandAttack;
    this.weaponSpeed = weaponSpeed;
    this.damage = 0;

    this.cast = function(player, target) {
        this.isCriticalStrike = Math.floor(Math.random() * 2) == 1;

        var attack = new Attack(
            player.name,
            player.target.name,
            "melee",
            "melee swing",
            this.isCriticalStrike,
            this.isCriticalStrike ? 200 : 100
        );
        
        this.damage = attack.damage;
        
        return attack;
    };
    
    this.generateEnergy = function(player) {
        // assuming level is 60.
        var conversionValue = 230.6;
        var hitFactor = this.isCriticalStrike && this.isMainhandAttack ? 7 : 3.5;
        var minRage = 15 * this.damage / conversionValue;
        var rage =
            15 * this.damage / (4 * conversionValue) + hitFactor * this.weaponSpeed / 2;
        var roundedRage = Math.round(Math.min(rage, minRage));
        
        return roundedRage;
    };
    
    this.update = function(delta) {
        
    }
}

function Bloodthirst() {
    this.name = "Bloodthirst";
    this.type = "attack";
    this.rank = 4;
    this.imageUrl =
        "https://wow.zamimg.com/images/wow/icons/large/spell_nature_bloodlust.jpg";
    this.description = "Instantly attack the target causing damage equal to 45% of your attack power.  In addition, the next 5 successful melee attacks will restore 10 health.  This effect lasts 8 sec.";
    this.energyCost = 30;
    this.energyType = "Rage";
    this.generatesEnergy = false;
    this.castTime = 0;
    this.castTimeRemaining = 0;
    this.causesGCD = true;
    this.cooldown = 7000;
    this.cooldownRemaining = 0;
    this.cooldownText = "6 sec";
    
    this.cast = function(caster, target) {
        // var damage = caster.stats.attackPower * 0.45;

        return new Attack(
                caster.name,
                target.name,
                "spell",
                "Bloodthirst",
                false,
                700
            );
    };
    
    this.update = function (delta) {
        
    }
}

function Bloodrage() {
    this.name = "Bloodrage";
    this.type = "aura";
    this.rank = 0;
    this.imageUrl = "https://wow.zamimg.com/images/wow/icons/large/ability_racial_bloodrage.jpg";
    this.description = "Generates 10 rage at the cost of health, and then generates an additional 10 rage over 10 sec.  The warrior is considered in combat for the duration.";
    this.energyCost = 30;
    this.energyType = "Rage";
    this.generatesEnergy = true;
    this.isActive = false;
    this.castTime = 0;
    this.castTimeRemaining = 0;
    this.causesGCD = true;
    this.cooldown = 60000;
    this.cooldownRemaining = 0;
    this.duration = 10000;
    this.durationRemaining = 0;
    
    var self = this;
    
    this.cast = function (player) {
        var healthPercentage = Utils.getPercentageFromValue(
            20,
            1000//player.health.max
        );
        
        player.health -= healthPercentage;
        
        console.log(player);
        
        //player.energy.add(20);
        
        
        self.isActive = true;
        self.durationRemaining = self.duration;
    }
    
    this.update = function (delta) {
        if (self.isActive && self.durationRemaining > 0) {
            self.durationRemaining -= delta;
        }
    }
}

function BattleShout() {
    this.name = "Battle Shout";
    this.type = "aura";
    this.rank = 6;
    this.imageUrl =
        "https://wow.zamimg.com/images/wow/icons/large/ability_warrior_battleshout.jpg";
    this.description = "The warrior shouts, increasing the attack power of all party members within 20 yards by 193.  Lasts 2 min.";
    this.energyCost = 10;
    this.energyType = "Rage";
    this.generatesEnergy = false;
    this.castTime = 0;
    this.castTimeRemaining = 0;
    this.causesGCD = true;
    this.cooldown = 0;
    this.cooldownRemaining = 0;
    this.duration = 120000;
    
    this.cast = function(player) {
       
    };
    
    this.update = function (delta) {
        
    }
}


function SpellQueue(onSpellCastComplete) {
    // spells that block other spells from being cast i.e. fireball, slam etc...
    this.activeSpells = [];
    // spells that do not block other spells from being cast while active i.e. buffs, battleshout etc... 
    this.passiveSpells = [];
    // this is a callback function that is executed whenever a spell cast completes.
    this.onSpellCastComplete = onSpellCastComplete;
    
    var self = this;

    this.queue = function(spell) {
        if (self.isQueued(spell.name)) {
            return;
        }
        
        if (spell.castTime > 0) {
            self.activeSpells.push(spell);
        } else {
            self.passiveSpells.push(spell);
        }
        
        spell.hasBeenCast = false;
        spell.castTimeRemaining = spell.castTime;
    };

    this.isQueued = function(spellName) {
        for (var i = 0; i < self.activeSpells.length; i++) {
            var spell = self.activeSpells[i];
            if (spell.name == spellName) {
                return true;
            }
        }
        for (var i = 0; i < self.passiveSpells.length; i++) {
            var spell = self.passiveSpells[i];
            if (spell.name == spellName) {
                return true;
            }
        }
        return false;
    };
    
    this.update = function(delta) {
  
        if (self.activeSpells.length > 0) {
            // activeSpells acts like a queue
            // we remove from the queue when the spell cast time is zero
            var activeSpellIndex = self.activeSpells[0];
            var activeSpell = self.activeSpells[activeSpellIndex];
        
            activeSpell.cooldownRemaining -= delta;

            if (activeSpell.cooldownRemaining <= 0) {
                self.onSpellCastComplete(activeSpell);
                self.activeSpells.splice(0, 1);
            }
        }
        
        for (var i = 0; i < self.passiveSpells.length; i++) {
            var passiveSpell = self.passiveSpells[i];
            passiveSpell.update(delta);
            
            if (passiveSpell.hasBeenCast &&
                passiveSpell.duration &&
                passiveSpell.durationRemaining > 0) {
                
                passiveSpell.durationRemaining -= delta;
            }
            
            if (!passiveSpell.hasBeenCast && 
                passiveSpell.castTimeRemaining > 0) {
                
                passiveSpell.castTimeRemaining -= delta;
            } 
            
            if (!passiveSpell.hasBeenCast && 
                passiveSpell.cooldownRemaining <= 0) {
                
                passiveSpell.cooldownRemaining = passiveSpell.cooldown;
                
                if (passiveSpell.duration) {
                    passiveSpell.durationRemaining = passiveSpell.duration;
                }
                
                passiveSpell.hasBeenCast = true;
                self.onSpellCastComplete(passiveSpell);
            }
            
            if (passiveSpell.hasBeenCast && 
                passiveSpell.cooldownRemaining > 0) {
                
                passiveSpell.cooldownRemaining -= delta;
            }
            
            if (passiveSpell.hasBeenCast && 
                !passiveSpell.duration && 
                passiveSpell.cooldownRemaining <= 0) {
                
                    self.passiveSpells.splice(i, 1);
                    i--;
            }
            
            if (passiveSpell.hasBeenCast && 
                passiveSpell.duration && 
                passiveSpell.durationRemaining <= 0 &&
                passiveSpell.cooldownRemaining <= 0) {
                
                    self.passiveSpells.splice(i, 1);
                    i--;
            }
        }
    };
}

function Tooltip (icon, content) {
    
    this.icon = icon;
    this.tooltip = null;
    this.content = content;
    var self = this;
    
    this.icon.mouseenter(function () {
        self.showTooltip();
    });
    
    this.icon.mouseleave(function () {
        self.hideTooltip();
    });
    
    this.showTooltip = function () {
        
        var tooltip = $("<div/>", { "class": "centered tool-tip" });
        this.tooltip = tooltip;
        
        tooltip.append(this.content);
        
        $(".tool-tip").remove();
        $("#tool-tips").append(tooltip);
        tooltip.show();
    };
    
    this.hideTooltip = function () {
       this.tooltip.hide();
    };
    
 }

function SpellTooltip (icon, spell) {
    
    var castTime = spell.castTime == 0 ? "Instant" : `${spell.castTime} seconds`;
    
    var title = $("<span>", { "text": spell.name });
    var rank = $("<span>", { "text": `Rank ${spell.rank}`, "class": "rank pull-right" });
    var cost = $("<div>", { "text": `${spell.energyCost} ${spell.energyType}` });
    var castTime = $("<span>", { "text": castTime });
    if (spell.cooldown > 0) {
    var cooldown = $("<span>", { "text": `${spell.cooldownText} cooldown`, "class": "cooldown" });   
    }
    var description = $("<div>", { "text": spell.description, "class": "description" });
    
    var content = $("<div>", { "class": "spell" });
    content.append(title, rank, cost, castTime, cooldown, description);
    
    var tooltip = new Tooltip(icon, content);
}

function BuffBar () {
    this.container = $("#buffs");
    this.buffs = [];
    
    var self = this;
    
    $(document).on(Events.playerCastSpell, function(e, spell) {
        
        if (spell.type != "aura") {
            return;
        }
        
        var icon = new BuffIcon(self.container, spell);
     
        self.buffs.push(icon);
    });
    
    
    this.update = function (delta) {
         for(var i = 0; i < this.buffs.length; i++) {
            var buffIcon = this.buffs[i];
             buffIcon.update(delta);
        }
    }
    
    this.render = function () {
        for(var i = 0; i < this.buffs.length; i++) {
            var buffIcon = this.buffs[i];
            
            buffIcon.render();
        }
    }
    
}

function BuffIcon(container, spell) {
    
    this.container = container;
    this.spell = spell;
    this.icon = null;
    this.hasRendered = false;
    this.hasExpired = false;
    this.durationRemainingText = null;
    
    var self = this;
    
    this.update = function (delta) {
        
        if (self.spell.durationRemaining > 60000) {
            this.durationRemainingText = `${(self.spell.durationRemaining / 60000).toFixed(0)}m`;
        } else {
            this.durationRemainingText = `${(self.spell.durationRemaining / 1000).toFixed(0)}s`;
        }
    }
    
    this.render = function () {
        
        if (self.hasRendered && 
            !self.hasExpired &&
            self.spell.durationRemaining <= 0) {
            
            self.hasExpired = true;
            self.icon.fadeOut();
        }
        
        if (self.hasRendered) {
            
            var timeRemaining = self.icon.find(".time-remaining");
            timeRemaining.text(self.durationRemainingText);
            
            return;
        } 
        
        var icon = $("<div>", { "class": "buff" });
        
        var art = $("<div>", { "class": "art" });
        art.css("background-image", `url('${spell.imageUrl}')`);
        
        var timeRemaining = $("<span>", { "text": self.durationRemainingText, "class": "time-remaining" });
        icon.append(art, timeRemaining);
        
        self.icon = icon;
        
        self.container.append(self.icon);
        self.hasRendered = true;
    }
}


var Factions = {
    horde: {
        races: {
            orc: {
                strength: 123,
                stamina: 112,
                agility: 77,
                intellect: 27,
                health: 1689
            }
        }
    }
}

function Gear () {
    
    var gear = this;
    gear.head = null;
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
