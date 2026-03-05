import React, {useEffect} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  Button,
  NativeModules,
  NativeEventEmitter,
  Alert,
} from 'react-native';

const {CarDrModule} = NativeModules;

const carDrEmitter = new NativeEventEmitter(CarDrModule);

function App(): React.JSX.Element {

  useEffect(() => {

    const vinListener = carDrEmitter.addListener(
      'onVINReceived',
      data => {
        console.log('VIN:', data.vin);
        Alert.alert('VIN Received', data.vin);
      },
    );

    const progressListener = carDrEmitter.addListener(
      'onScanProgress',
      data => {
        console.log('Progress:', data.percent);
      },
    );

    return () => {
      vinListener.remove();
      progressListener.remove();
    };

  }, []);

  const initializeSDK = () => {
    CarDrModule.initializeSDK("accut6390c3141f");
  };

  const scanDevice = () => {
    CarDrModule.scanForDevice();
  };
  const startScan = () => {
    CarDrModule.startScan();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <Text style={styles.title}>CarDr OBD SDK Demo</Text>

        <Button
          title="Initialize SDK"
          onPress={initializeSDK}
        />

        <View style={{height: 20}} />

        <Button
          title="Scan Device"
          onPress={scanDevice}
        />

         <View style={{height: 20}} />

        <Button
          title="Start Scan"
          onPress={startScan}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
  },
  content: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 40,
    textAlign: 'center',
  },
});

export default App;