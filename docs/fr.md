# Wake on LAN

Voici la documentation utilisateur de l'intégration. Gladys héberge ce
fichier et affiche un lien **Documentation** permanent dans l'écran de
Configuration — c'est au moment de la configuration que vous en avez le plus
besoin.

## Ce que vous obtenez

Wake on LAN vous permet d'enregistrer des appareils de votre réseau — un
PC de bureau, un NAS, un serveur multimédia — et de leur envoyer un **paquet
magique** pour les allumer à distance d'un simple clic dans Gladys.

Comme ces appareils sont éteints par définition, aucun scan réseau ne peut
les découvrir. Vous enregistrez chacun à la main (nom, adresse MAC) via
l'action **Ajouter un appareil**, puis le créez depuis l'onglet
**Découverte** comme n'importe quel autre appareil Gladys.

## Prérequis

- **Le Wake-on-LAN doit être activé sur l'appareil ciblé** : dans son
  BIOS/UEFI (« Power On by PCI-E/PCIE », « Wake on LAN »…) et dans les
  paramètres du pilote de sa carte réseau (Windows : Propriétés de la carte
  → Gestion de l'alimentation / Avancé).
- L'appareil doit de préférence rester **branché en Ethernet**. Le support
  du Wake-on-LAN en Wi-Fi est très inégal selon les cartes et souvent
  désactivé une fois l'ordinateur complètement éteint.
- L'appareil et le serveur Gladys doivent être sur le **même réseau local**
  (ou un réseau dont le routeur relaie le trafic broadcast) — le paquet
  magique est un broadcast LAN, il n'est pas routé sur Internet.

## Configuration

1. Utilisez l'action **Ajouter un appareil** pour enregistrer un appareil
   (nom, adresse MAC, et en option son adresse IP pour votre référence).
2. Ouvrez l'onglet **Découverte** et créez l'appareil qui vient d'apparaître.
3. L'appareil dispose maintenant d'un interrupteur **Wake** dans votre
   dashboard Gladys. Activez-le pour envoyer le paquet magique et allumer la
   machine.

## Actions

- **Ajouter un appareil** — enregistre un appareil (ou le met à jour si vous
  ajoutez à nouveau la même adresse MAC).
- **Supprimer un appareil** — arrête de proposer un appareil enregistré
  (son historique dans Gladys est conservé, comme pour n'importe quelle autre
  intégration).
- **Envoyer un Wake-on-LAN** — un moyen rapide de tester le réveil sans
  quitter l'écran de Configuration ; l'interrupteur **Wake** de l'appareil
  fait exactement la même chose.

## Comment le paquet magique est réellement envoyé

Le conteneur de l'intégration s'exécute isolé sur son propre réseau : un
paquet broadcast qu'il tenterait d'envoyer directement n'atteindrait jamais
votre réseau local. Wake on LAN demande donc au cœur de Gladys lui-même
(qui tourne sur votre réseau local) de diffuser le paquet magique en son
nom — un broadcast *médié*, déclaré dans le manifeste de l'intégration. De
ce fait, une seule demande de réveil est acceptée toutes les 10 secondes ;
si vous cliquez à nouveau sur « Wake » immédiatement, patientez quelques
secondes puis réessayez.

## Dépannage

- **Rien ne se passe quand je clique sur Wake** : vérifiez que le
  Wake-on-LAN est activé dans le BIOS/UEFI et la carte réseau, et que
  l'appareil est branché en Ethernet. Certains commutateurs/routeurs avec un
  cloisonnement client strict ou de l'IGMP snooping peuvent aussi bloquer les
  broadcasts LAN.
- L'intégration journalise tout ce qu'elle fait : consultez les logs depuis
  l'interface Gladys (ou `docker logs` sur l'hôte) avec `LOG_LEVEL=debug`
  pour le détail complet.


## Ce que vous obtenez

LAN Manager permet d'enregistrer des appareils classiques de votre réseau
local — un PC de bureau, un NAS, un serveur multimédia — qui n'ont ni API
cloud ni protocole local propre, afin que Gladys puisse :

- leur envoyer un paquet magique **Wake-on-LAN** pour les allumer à
  distance ;
- éventuellement **surveiller s'ils sont en ligne**, rafraîchi
  périodiquement.

Comme ces appareils sont généralement éteints, aucun scan réseau ne peut les
découvrir : vous enregistrez chacun à la main (nom, adresse MAC, adresse IP)
via l'action **Ajouter un appareil**, puis le créez depuis l'onglet
**Découverte** comme n'importe quel autre appareil.

## Prérequis

- **Le Wake-on-LAN doit être activé sur l'appareil ciblé** : dans son
  BIOS/UEFI ("Power On by PCI-E/PCIE", "Wake on LAN"...) et dans les
  paramètres du pilote de sa carte réseau (Windows : Propriétés de la carte →
  Gestion de l'alimentation / Avancé).
- L'appareil doit de préférence rester **branché en Ethernet**. Le support du
  Wake-on-LAN en Wi-Fi est très inégal selon les cartes et souvent désactivé
  une fois l'ordinateur complètement éteint.
- L'appareil enregistré et le serveur Gladys doivent être sur le **même
  réseau local** (ou un réseau dont le routeur relaie le trafic broadcast) —
  le paquet magique est un broadcast LAN, il n'est pas routé sur Internet.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration et lisez la section
   « Fonctionnement ».
2. Ajustez éventuellement la **détection de présence** : activez-la ou non,
   réglez le port TCP par défaut sondé pour savoir si un appareil est en
   ligne, et l'intervalle de rafraîchissement.
3. Utilisez l'action **Ajouter un appareil** pour enregistrer un appareil
   (nom, adresse MAC, adresse IP, et un port de détection optionnel propre à
   cet appareil).
4. Ouvrez l'onglet **Découverte** et créez l'appareil qui vient d'apparaître.

## Actions

- **Ajouter un appareil** — enregistre un appareil (ou le met à jour si vous
  ajoutez à nouveau la même adresse MAC).
- **Supprimer un appareil** — choisissez un de vos appareils enregistrés
  pour arrêter de le proposer (son historique est conservé, comme pour
  n'importe quelle autre intégration).
- **Envoyer un Wake-on-LAN** — un moyen rapide de tester le réveil sans
  quitter l'écran de Configuration ; le bouton « Wake » de l'appareil fait
  exactement la même chose.

## Comment le Wake-on-LAN est réellement envoyé

Le conteneur de l'intégration s'exécute isolé sur son propre réseau : un
paquet broadcast qu'il tenterait d'envoyer directement n'atteindrait jamais
votre réseau local. LAN Manager demande donc au cœur de Gladys lui-même
(qui, lui, tourne sur votre réseau local) de diffuser le paquet magique en
son nom — un broadcast « médié », déclaré dans le manifeste de
l'intégration. De ce fait, une seule demande de réveil est acceptée toutes
les 10 secondes ; si vous cliquez à nouveau sur « Wake » immédiatement,
patientez quelques secondes puis réessayez.

## Dépannage

- **Rien ne se passe quand je clique sur Wake** : vérifiez que le
  Wake-on-LAN est activé dans le BIOS/UEFI et la carte réseau, et que
  l'appareil est branché en Ethernet. Certains commutateurs/routeurs avec un
  cloisonnement client strict ou de l'IGMP snooping peuvent aussi bloquer les
  broadcasts LAN.
- **La présence est toujours hors ligne pour un appareil que je sais
  allumé** : essayez un autre port de détection — un pare-feu strict sur
  l'appareil peut bloquer le port par défaut. N'importe quel port TCP laissé
  ouvert par le pare-feu de l'appareil convient.
- L'intégration journalise tout ce qu'elle fait : consultez les logs de
  l'intégration depuis l'interface Gladys (ou `docker logs` sur l'hôte) avec
  `LOG_LEVEL=debug` pour le détail complet.
