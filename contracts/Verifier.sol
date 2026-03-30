// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 6820245025717241602298318461380050881004290245379065834502461208617650683629;
    uint256 constant alphay  = 2840144800465018357315693612461463164544561333183642071697069344087207386308;
    uint256 constant betax1  = 16643024873744647950489985689067864986202908560098718834867824980465258924651;
    uint256 constant betax2  = 5619005930814255495768978269093667245304627352706554914118891510984517281248;
    uint256 constant betay1  = 13241705442977089012499332456846005427380822878616448479647118287610882912485;
    uint256 constant betay2  = 15921620249204654416182284330840018430875675912533022361520576650479131109803;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 16028385340657220667495088333143411312314808621276347332087723160956922040935;
    uint256 constant deltax2 = 17041399651100826841648161555558199240402881681752714053957604747032377588379;
    uint256 constant deltay1 = 216280843741416817727993128806537162655742836476091224376774587858589816909;
    uint256 constant deltay2 = 6026678947092036356687761803522257757145373031152908735373124888193483697132;

    
    uint256 constant IC0x = 12804688416283749300276365456445615333011648651518672184893853966349650369727;
    uint256 constant IC0y = 17266361608649186742195880409797083678138766575892358284808254744767926695198;
    
    uint256 constant IC1x = 944126323712160193797551485607744772684924577173627552728260588817238854321;
    uint256 constant IC1y = 21757436817832924330215688226318452748332508768021107374787484059733934799967;
    
    uint256 constant IC2x = 3032340649762383929699399332302389909579944562422107025263003376516552602809;
    uint256 constant IC2y = 17124810850860519361462929175374898163661661327639662184965547253624951772334;
    
    uint256 constant IC3x = 10733466829776702141162793564818486504152809837556106375468439898510150176789;
    uint256 constant IC3y = 5865261303279930872185294130086660122792495820508983848147837192152823231928;
    
    uint256 constant IC4x = 14644791711030337890968226240345362888547396244724659129637473529218602207728;
    uint256 constant IC4y = 2889875909068481625180641094879408111869557590703438720301120740130483424713;
    
    uint256 constant IC5x = 18171081033973368602373913083066536461440942215760883399755145328561823819098;
    uint256 constant IC5y = 8064659862968149652627754219055018289843763809991204561391902811369111696206;
    
    uint256 constant IC6x = 3169685182985220021267251698943664160480525092277211303344652002729273333444;
    uint256 constant IC6y = 17429203221486490585149343434703863857990465328340811950862850028250669923417;
    
    uint256 constant IC7x = 15769511447781840318620934353513947804793446083386877916742683765294228100456;
    uint256 constant IC7y = 10756466119002020116482295737075888308548649374871577901717986518152012269138;
    
    uint256 constant IC8x = 16868941411763303359905066232144924120417227547084760635886547888523600048156;
    uint256 constant IC8y = 546334455458750746778946330034567258837873255823375180748048422147195473992;
    
    uint256 constant IC9x = 2211325181991744396214979752921642732925745982368842080811976271715163033506;
    uint256 constant IC9y = 799149637100653819420730056855387288579697450650743429062667156070203690807;
    
    uint256 constant IC10x = 10793429978877523220966750114037642873624010931374240798311369520975445264637;
    uint256 constant IC10y = 5311976969561986850727793005086072758037993027981795939425374801893789533268;
    
    uint256 constant IC11x = 7481478364909450987951191113312867770018673055182359974030092089466095106346;
    uint256 constant IC11y = 10062375979121686016105852735500144073394880426520100837338824618919882561095;
    
    uint256 constant IC12x = 14593369227104175741195716411149584145585454466978411606827049821374334961399;
    uint256 constant IC12y = 16817126302585690272031668696104506225346021260388960443776952936747937056193;
    
    uint256 constant IC13x = 15980275283819469346361275939399986290853612240567784039279813455982150223876;
    uint256 constant IC13y = 15876637144946225082834584858749772675589445395648396070849266022514894855356;
    
    uint256 constant IC14x = 43076448321581273471637299477263589319050567048457061969660453726123855094;
    uint256 constant IC14y = 1712233180659577139281385678474201743264665173996496989916273927126764362192;
    
    uint256 constant IC15x = 18516095609518160552218908079635493574051363950961022233474434314714742588744;
    uint256 constant IC15y = 10885784449766442483833841135014641615476286240261724906906187259409467082538;
    
    uint256 constant IC16x = 12866169530709743590690890684329523104704023932090659759286167490284435017888;
    uint256 constant IC16y = 1639532087550191666809132468480506631298447575481112134556326931168174329811;
    
    uint256 constant IC17x = 3323576790816552556768851873978733258593408033280617608035040225958434230685;
    uint256 constant IC17y = 8962043969893245921407185703601077422245553991963198541792716140239031889631;
    
    uint256 constant IC18x = 10029380183258324142205738798792394314565986405608414384203239279488210149826;
    uint256 constant IC18y = 10814709423253772372918394794488845180073476911223928859509988389136904258928;
    
    uint256 constant IC19x = 1087135876075678610506778925422139926409692493568331914443537895745554536018;
    uint256 constant IC19y = 11819742805539519630267630387193595874064857841219487771898892278049228678872;
    
    uint256 constant IC20x = 7796562134476357808789919022656854162325751497932200223457200380638008887769;
    uint256 constant IC20y = 1508609335633198457048483925243049954138647290667334246631883303508404292723;
    
    uint256 constant IC21x = 3179798267982914379688585922420069306191671538317237358367491516167110920494;
    uint256 constant IC21y = 9635064605749762170053156489005781736220040879746689851300877833917443238199;
    
    uint256 constant IC22x = 9184418449744365021114406621303452388106565937935339027643832188633407452224;
    uint256 constant IC22y = 2841890298448254702106920674794800376981419848238178000650077170643281138405;
    
    uint256 constant IC23x = 10427764642671737133754767567462833061856687687357479437246816620555642104008;
    uint256 constant IC23y = 7801865521876733413218937227645129539495879014156036870342681668378878571139;
    
    uint256 constant IC24x = 4750366189954572681141912247120196136998620333543053070914499712309774305528;
    uint256 constant IC24y = 1213110764600232859411352448118498528457771854433470863413851341549329060739;
    
    uint256 constant IC25x = 15398172161842793496347284537948822261648562786517079828294594807941340649846;
    uint256 constant IC25y = 7488411759642202766414808103444506447638384443674791758348372984779848347757;
    
    uint256 constant IC26x = 15052504658056984268761629225844204735133699648185531033024897591029792000610;
    uint256 constant IC26y = 3792680771051260161530678601108547577130934185865404874057278909211137894179;
    
    uint256 constant IC27x = 2309213844311650258524516895270658973400336757977651846587085845261199664698;
    uint256 constant IC27y = 12636646159380916308187245101250248539208205280895799813209462221971272561618;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[27] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                
                g1_mulAccC(_pVk, IC22x, IC22y, calldataload(add(pubSignals, 672)))
                
                g1_mulAccC(_pVk, IC23x, IC23y, calldataload(add(pubSignals, 704)))
                
                g1_mulAccC(_pVk, IC24x, IC24y, calldataload(add(pubSignals, 736)))
                
                g1_mulAccC(_pVk, IC25x, IC25y, calldataload(add(pubSignals, 768)))
                
                g1_mulAccC(_pVk, IC26x, IC26y, calldataload(add(pubSignals, 800)))
                
                g1_mulAccC(_pVk, IC27x, IC27y, calldataload(add(pubSignals, 832)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            
            checkField(calldataload(add(_pubSignals, 672)))
            
            checkField(calldataload(add(_pubSignals, 704)))
            
            checkField(calldataload(add(_pubSignals, 736)))
            
            checkField(calldataload(add(_pubSignals, 768)))
            
            checkField(calldataload(add(_pubSignals, 800)))
            
            checkField(calldataload(add(_pubSignals, 832)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
